import os
import re
import shutil

MD = "/Users/qingfeng/Documents/attack/ZZ/accout_management/测试报告.md"
SRC = "/Users/qingfeng/Library/Application Support/typora-user-images"
DST = "/Users/qingfeng/Documents/attack/ZZ/accout_management/pictures"

os.makedirs(DST, exist_ok=True)

with open(MD, "r", encoding="utf-8") as f:
    text = f.read()

pattern = re.compile(
    r"\((/Users/qingfeng/Library/Application Support/typora-user-images/(image-[^)]+\.png))\)"
)

names = [m[1] for m in pattern.findall(text)]
unique = sorted(set(names))

copied, missing = [], []
for name in unique:
    src = os.path.join(SRC, name)
    dst = os.path.join(DST, name)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        copied.append(name)
    else:
        missing.append(name)

new_text = pattern.sub(r"(pictures/\2)", text)

with open(MD, "w", encoding="utf-8") as f:
    f.write(new_text)

print(f"处理图片总数: {len(unique)}")
print(f"成功拷贝: {len(copied)}")
if missing:
    print("缺失图片:")
    for m in missing:
        print(" -", m)

remaining = new_text.count("/Users/qingfeng/Library")
print(f"Markdown 中残留的绝对路径数: {remaining}")