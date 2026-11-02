"""
Sample past papers aur book generate karta hai (test fixtures ke liye).
Questions jaan boojh kar rephrase kiye gaye hain, jaise real papers mein hota hai.
Run: python3 tests/fixtures/make_fixtures.py
"""
import os
from docx import Document
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

HERE = os.path.dirname(os.path.abspath(__file__))

PAPERS = {
    2020: [
        "Define Newton's second law of motion and explain its significance in daily life.",
        "Calculate the kinetic energy of a 5 kg object moving at 10 m/s.",
        "Describe the process of photosynthesis in plants.",
        "Explain the role of chlorophyll in the light reaction of photosynthesis.",
        "Find the final velocity of a body that accelerates uniformly from rest for 4 seconds.",
    ],
    2021: [
        "State Newton's second law of motion and explain its importance in everyday life.",
        "Find the kinetic energy of an object of mass 5 kg moving with a speed of 10 m/s.",
        "Describe the structure of a plant cell with a labelled diagram.",
        "Explain why the cell membrane is selectively permeable.",
        "Define osmosis and give one example from daily life.",
    ],
    2022: [
        "Explain Newton's second law and give two examples of it in daily life.",
        "Calculate the work done when a force of 20 N moves an object through 3 m.",
        "Describe the role of light and chlorophyll in photosynthesis.",
        "Define diffusion and differentiate it from osmosis.",
        "Calculate the final velocity of a car accelerating uniformly from rest for 6 seconds.",
    ],
    2023: [
        "State Newton's second law of motion and explain its significance in everyday life.",
        "Calculate the kinetic energy of an object of mass 5 kg moving at 10 m/s.",
        "Explain the importance of the Krebs cycle in cellular respiration.",
        "Describe the mechanism of photosynthesis and name its two main stages.",
        "Describe the working of a simple electric circuit with a labelled diagram.",
    ],
    2024: [
        "Explain the significance of Newton's second law in daily life with two examples.",
        "Find the kinetic energy of a 5 kg object travelling at 10 m/s.",
        "Explain the role of chlorophyll in photosynthesis.",
        "Find the final velocity of a body starting from rest and accelerating uniformly for 4 seconds.",
        "Define osmosis and explain how it differs from diffusion.",
    ],
}

BOOK = [
    "Chapter 1: Laws of Motion",
    "Newton's second law states that the net force on an object equals its mass times its acceleration. "
    "It explains why heavier objects need more force to speed up.",
    "Chapter 2: Energy",
    "The kinetic energy of a moving object is half its mass multiplied by the square of its speed.",
    "Chapter 3: Photosynthesis",
    "Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs light in the chloroplast.",
    "Chapter 4: Cell Biology",
    "The cell membrane is selectively permeable. Osmosis is the movement of water across a membrane.",
]


def pdf_paper(path, questions):
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(path, pagesize=A4)
    story = []
    for i, q in enumerate(questions, start=1):
        story.append(Paragraph(f"{i}. {q}", styles["BodyText"]))
        story.append(Spacer(1, 10))
    doc.build(story)


def pdf_book(path, lines):
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(path, pagesize=A4)
    story = []
    for line in lines:
        story.append(Paragraph(line, styles["BodyText"]))
        story.append(Spacer(1, 6))
    doc.build(story)


def docx_paper(path, questions):
    doc = Document()
    for i, q in enumerate(questions, start=1):
        doc.add_paragraph(f"{i}. {q}")
    doc.save(path)


def xlsx_paper(path, questions):
    wb = Workbook()
    ws = wb.active
    ws.title = "Paper"
    ws.append(["No", "Question"])
    for i, q in enumerate(questions, start=1):
        ws.append([i, q])
    wb.save(path)


if __name__ == "__main__":
    pdf_paper(os.path.join(HERE, "paper_2020.pdf"), PAPERS[2020])
    pdf_paper(os.path.join(HERE, "paper_2021.pdf"), PAPERS[2021])
    docx_paper(os.path.join(HERE, "paper_2022.docx"), PAPERS[2022])
    pdf_paper(os.path.join(HERE, "paper_2023.pdf"), PAPERS[2023])
    xlsx_paper(os.path.join(HERE, "paper_2024.xlsx"), PAPERS[2024])
    pdf_book(os.path.join(HERE, "book.pdf"), BOOK)
    print("fixtures written to", HERE)
