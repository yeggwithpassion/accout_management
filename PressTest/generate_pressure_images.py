from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PICTURES_DIR = ROOT / "pictures"
PICTURES_DIR.mkdir(parents=True, exist_ok=True)

SUMMARY_IMAGE = PICTURES_DIR / "pressure-test-result-summary.png"
ERROR_IMAGE = PICTURES_DIR / "pressure-test-error-analysis.png"

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\arial.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_TITLE = load_font(30)
FONT_HEAD = load_font(20)
FONT_BODY = load_font(18)
FONT_SMALL = load_font(16)


def draw_summary_image() -> None:
    image = Image.new("RGB", (1700, 520), "white")
    draw = ImageDraw.Draw(image)

    draw.text((40, 25), "压力测试结果汇总（真实 MySQL）", fill="black", font=FONT_TITLE)
    draw.text((40, 70), "数据来源：PressTest/results/pressure-test-summary.csv", fill=(80, 80, 80), font=FONT_SMALL)

    headers = ["场景", "并发度", "任务数", "成功", "失败", "平均耗时(ms)", "P95(ms)", "P99(ms)", "吞吐(op/s)", "结论"]
    rows = [
        ["并发开户链路", "10", "30", "30", "0", "71.97", "131", "131", "136.99", "通过"],
        ["重复资金回调幂等", "24", "120", "120", "0", "36.85", "80", "88", "606.06", "通过"],
        ["重复持仓回调幂等", "24", "120", "120", "0", "41.22", "71", "81", "545.45", "通过"],
        ["混合并发查询", "40", "400", "385", "15", "1020.33", "3495", "4409", "37.38", "未通过"],
    ]
    column_widths = [310, 100, 100, 90, 90, 150, 110, 110, 130, 100]
    start_x = 40
    start_y = 120
    row_height = 62

    current_x = start_x
    for header, width in zip(headers, column_widths):
        draw.rectangle([current_x, start_y, current_x + width, start_y + row_height], outline="black", width=2, fill=(230, 238, 250))
        draw.text((current_x + 10, start_y + 17), header, fill="black", font=FONT_HEAD)
        current_x += width

    for row_index, row in enumerate(rows, start=1):
        current_x = start_x
        current_y = start_y + row_index * row_height
        fill = (255, 255, 255) if row_index % 2 else (248, 248, 248)
        for cell, width in zip(row, column_widths):
            draw.rectangle([current_x, current_y, current_x + width, current_y + row_height], outline="black", width=1, fill=fill)
            color = (180, 0, 0) if cell == "未通过" else "black"
            draw.text((current_x + 10, current_y + 17), cell, fill=color, font=FONT_BODY)
            current_x += width

    image.save(SUMMARY_IMAGE)


def draw_error_image() -> None:
    image = Image.new("RGB", (1700, 760), "white")
    draw = ImageDraw.Draw(image)

    draw.text((40, 25), "混合并发查询失败摘要", fill="black", font=FONT_TITLE)
    draw.text((40, 70), "数据来源：PressTest/pressure-test-report.md", fill=(80, 80, 80), font=FONT_SMALL)

    lines = [
        "场景：混合并发查询    并发度：40    总任务数：400    成功：385    失败：15",
        "平均耗时：1020.33 ms    P95：3495 ms    P99：4409 ms    吞吐量：37.38 op/s",
        "",
        "失败现象：",
        "1. 高并发读请求下出现系统内部错误（code=5000）。",
        "2. 失败样例集中在 security_account / investor 查询路径。",
        "",
        "根因分析：",
        "1. DAO 读路径通过 DriverManager.getConnection(...) 即时创建 MySQL 连接。",
        "2. Dashboard 与账户列表路径会把一次请求放大成多次数据库查询。",
        "3. 在 40 并发、400 总请求下，快速建连触发客户端侧 socket/临时端口资源耗尽。",
        "4. CommunicationsException 表示 JDBC 驱动未能成功建立数据库连接。",
        "5. BindException: Address already in use: connect 指向客户端连接资源耗尽，",
        "   不是 SQL 语法错误，也不是表结构错误。",
    ]

    current_y = 130
    for line in lines:
        draw.text((40, current_y), line, fill="black", font=FONT_BODY)
        current_y += 42

    image.save(ERROR_IMAGE)


def main() -> None:
    draw_summary_image()
    draw_error_image()
    print(SUMMARY_IMAGE)
    print(ERROR_IMAGE)


if __name__ == "__main__":
    main()
