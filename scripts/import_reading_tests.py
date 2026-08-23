#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

from docx import Document
from lxml import html
from pypdf import PdfReader


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def level_for(number: int) -> str:
    if number <= 4:
        return "A1"
    if number <= 10:
        return "A2"
    if number <= 19:
        return "B1"
    if number <= 29:
        return "B2"
    return "C1"


def answer_keys(pdf_path: Path) -> dict[int, dict[int, str]]:
    text = "\n".join(page.extract_text() or "" for page in PdfReader(pdf_path).pages)
    starts = list(re.finditer(r"(?m)^Test\s+(\d+)\s*$", text))
    keys: dict[int, dict[int, str]] = {}
    for index, match in enumerate(starts):
        test = int(match.group(1))
        segment = text[match.end():starts[index + 1].start() if index + 1 < len(starts) else len(text)]
        quick = segment.split("Quick Answer Key", 1)[-1].split("Correct Option", 1)[0]
        answers = {int(number): letter for number, letter in re.findall(r"(\d+)\s*[-–]\s*([A-D])", quick)}
        if len(answers) != 39:
            raise ValueError(f"Test {test}: expected 39 answers, found {len(answers)}")
        keys[test] = answers
    if set(keys) != set(range(1, 41)):
        raise ValueError(f"Expected answer keys 1-40, found {sorted(keys)}")
    return keys


def parse_html(path: Path) -> list[dict]:
    document = html.fromstring(path.read_text(encoding="utf-8-sig"))
    questions = []
    select = lambda node, class_name: node.xpath(f'.//*[contains(concat(" ", normalize-space(@class), " "), " {class_name} ")]')
    for block in select(document, "question-block"):
        heading = clean(" ".join(select(block, "question-heading")[0].itertext()))
        match = re.search(r"Question\s+(\d+)\s*[—-]\s*([A-C]\d)", heading)
        if not match:
            raise ValueError(f"Cannot parse heading in {path.name}: {heading}")
        passage_nodes = select(block, "passage")
        question_nodes = select(block, "question")
        options = [clean(" ".join(node.itertext())) for node in select(block, "option")]
        questions.append({
            "number": int(match.group(1)),
            "level": level_for(int(match.group(1))),
            "passage": clean(" ".join(passage_nodes[0].itertext())) if passage_nodes else "",
            "question": clean(" ".join(question_nodes[0].itertext())) if question_nodes else "",
            "options": [re.sub(r"^[A-D][.)]?\s*", "", option) for option in options],
        })
    return questions


def parse_docx(path: Path) -> list[dict]:
    paragraphs = [clean(paragraph.text) for paragraph in Document(path).paragraphs if clean(paragraph.text)]
    starts = [index for index, value in enumerate(paragraphs) if re.fullmatch(r"Question\s+\d+\s*[—-]\s*[A-C]\d", value)]
    questions = []
    for position, start in enumerate(starts):
        segment = paragraphs[start:starts[position + 1] if position + 1 < len(starts) else len(paragraphs)]
        match = re.fullmatch(r"Question\s+(\d+)\s*[—-]\s*([A-C]\d)", segment[0])
        labels = {value: index for index, value in enumerate(segment) if value in {"Passage", "Question", "Options"}}
        question_index, options_index = labels["Question"], labels["Options"]
        passage = " ".join(segment[labels["Passage"] + 1:question_index]) if "Passage" in labels else ""
        question = " ".join(segment[question_index + 1:options_index])
        options = [re.sub(r"^[A-D][.)]?\s*", "", value) for value in segment[options_index + 1:] if re.match(r"^[A-D][.)]", value)]
        questions.append({"number": int(match.group(1)), "level": level_for(int(match.group(1))), "passage": clean(passage), "question": clean(question), "options": options})
    return questions


def main() -> None:
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    keys = answer_keys(source / "TCF Reading Complete Answer Key - Tests 1-40.pdf")
    output.mkdir(parents=True, exist_ok=True)
    for test in range(1, 41):
        if test == 1:
            questions = parse_docx(source / "TCF_Reading_Test_1 .docx")
        else:
            questions = parse_html(source / f"TCF_Reading_Test_{test}.doc")
        if len(questions) != 39 or any(len(question["options"]) != 4 for question in questions):
            raise ValueError(f"Test {test}: expected 39 questions with four options")
        for question in questions:
            if not question["question"]:
                question["question"] = "Choisissez la bonne réponse."
            question["correct"] = keys[test][question["number"]]
        (output / f"test-{test:02}.json").write_text(json.dumps({"test": test, "questions": questions}, ensure_ascii=False), encoding="utf-8")
    print("Imported 40 tests / 1560 questions")


if __name__ == "__main__":
    main()
