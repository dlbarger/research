""""
    Script: get_pdf_data.py
    Date:   8/12/2020
""""

import PyPDF2

# Build pdf reader

pdf_file = './data/blueprint.pdf'
pdf_obj = open(pdf_file, 'rb')
pdf_reader = PyPDF2.PdfFileReader(pdf_obj)

# Let's see what's in the file

page_cnt = pdf_reader.numPages

print("Number of Pages: " + str(page_cnt))

