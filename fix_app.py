with open("src/App.jsx", "r") as f:
    content = f.read()

content = content.replace("import BessAnalytica", "import BESSAnalytica")
content = content.replace("<BessAnalytica />", "<BESSAnalytica />")

with open("src/App.jsx", "w") as f:
    f.write(content)
