"""
Script: get_image_text.py
Date:   8/12/2020

Description: Read image and extract text
"""

import pytesseract

fl = './data/blueprint.pdf'

pytesseract.pytesseract.tesseract_cmd = fl
print(pytesseract.image_to_string(fl))