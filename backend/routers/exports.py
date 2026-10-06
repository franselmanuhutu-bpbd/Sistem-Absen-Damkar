from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import Optional
import io

from config import STATUSES, STATUS_LABEL, STATUS_HEX
from database import get_db, fetch_all
from auth import get_current_user, require_roles
from utils import (
    last_day_of_month,
    _compute_recap,
    _compute_kasubid_recap,
)

router = APIRouter(tags=["Exports"])

KOP = {
    "l1": "BADAN PENANGGULANGAN BENCANA DAERAH",
    "l2": "KABUPATEN MIMIKA",
    "l3": "BIDANG PEMADAM KEBAKARAN",
    "addr": "Jl. Cenderawasih Km. 2, Timika, Papua Tengah",
}


@router.get("/export/excel")
async def export_excel(
    start: str,
    end: str,
    team_id: str = None,
    category: str = None,
    include_breakdown: bool = True,
    include_detail: bool = False,
    user: dict = Depends(get_current_user),
):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.utils import get_column_letter

    data = await _compute_recap(start, end, team_id or None, category or None)
    wb = Workbook()
    thin = Side(style="thin", color="94A3B8")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_fill = PatternFill("solid", fgColor="0F172A")
    header_font = Font(bold=True, color="FFFFFF")
    title_font = Font(bold=True, size=14, color="0F172A")
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)

    def style_header(ws, row, ncols):
        for c in range(1, ncols + 1):
            cell = ws.cell(row=row, column=c)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center
            cell.border = border

    def autofit(ws, ncols, start_row=1):
        for c in range(1, ncols + 1):
            mx = 10
            for r in range(start_row, ws.max_row + 1):
                v = ws.cell(row=r, column=c).value
                if v is not None:
                    mx = max(mx, len(str(v)) + 2)
            ws.column_dimensions[get_column_letter(c)].width = min(mx, 45)

    ws = wb.active
    ws.title = "Ringkasan"
    cols = ["No", "NIP", "Nama", "Regu", "Kategori", "Jabatan"] + STATUSES + ["Total"]
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(cols))
    ws.cell(row=1, column=1, value=f"{KOP['l1']} {KOP['l2']} \u2014 {KOP['l3']}").font = title_font
    ws.cell(row=1, column=1).alignment = center
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(cols))
    ws.cell(row=2, column=1, value="REKAPITULASI ABSENSI PEGAWAI").font = Font(bold=True, size=12)
    ws.cell(row=2, column=1).alignment = center
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=len(cols))
    ws.cell(row=3, column=1, value=f"Periode: {data['period_label']}   |   Dicetak: {datetime.now().strftime('%d-%m-%Y %H:%M')}")
    ws.cell(row=3, column=1).alignment = center

    hr = 5
    for i, c in enumerate(cols, 1):
        ws.cell(row=hr, column=i, value=c)
    style_header(ws, hr, len(cols))
    r = hr + 1
    for row in data["rows"]:
        vals = [row["no"], row["nip"], row["nama"], row["regu"], row["category"], row["jabatan"]] + [row[s] for s in STATUSES] + [row["total"]]
        for i, v in enumerate(vals, 1):
            cell = ws.cell(row=r, column=i, value=v)
            cell.border = border
            if 7 <= i <= 12:
                cell.alignment = center
                cell.fill = PatternFill("solid", fgColor=STATUS_HEX[STATUSES[i - 7]])
                cell.font = Font(color="FFFFFF", bold=True)
        r += 1

    ws.cell(row=r, column=1, value="TOTAL").font = Font(bold=True)
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    for i, s in enumerate(STATUSES):
        cell = ws.cell(row=r, column=7 + i, value=data["grand_total"][s])
        cell.font = Font(bold=True)
        cell.alignment = center
        cell.border = border
    ws.cell(row=r, column=13, value=sum(data["grand_total"].values())).font = Font(bold=True)
    autofit(ws, len(cols), hr)
    ws.freeze_panes = ws.cell(row=hr + 1, column=1)
    ws.auto_filter.ref = f"A{hr}:{get_column_letter(len(cols))}{hr}"

    if include_breakdown and len(data["breakdown"]) > 0:
        wb2 = wb.create_sheet("Breakdown Bulanan")
        bcols = ["No", "Nama", "Regu", "Bulan"] + STATUSES + ["Total"]
        for i, c in enumerate(bcols, 1):
            wb2.cell(row=1, column=i, value=c)
        style_header(wb2, 1, len(bcols))
        rr = 2
        for b in data["breakdown"]:
            vals = [b["no"], b["nama"], b["regu"], b["month_label"]] + [b[s] for s in STATUSES] + [b["total"]]
            for i, v in enumerate(vals, 1):
                c = wb2.cell(row=rr, column=i, value=v)
                c.border = border
                if 5 <= i <= 10:
                    c.alignment = center
            rr += 1
        autofit(wb2, len(bcols))
        wb2.freeze_panes = "E2"

    if include_detail:
        wb3 = wb.create_sheet("Detail Absensi")
        db = await get_db()
        sy, sm = int(start[:4]), int(start[5:7])
        ey, em = int(end[:4]), int(end[5:7])
        sd = f"{start}-01"
        ed = f"{end}-{last_day_of_month(ey, em):02d}"
        q = db.table("attendance").select("*").gte("date", sd).lte("date", ed).order("date")
        records = await fetch_all(q)
        emps = {e["id"]: e for e in ((await db.table("employees").select("*").execute()).data or [])}
        teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}
        dcols = ["Tanggal", "NIP", "Nama", "Regu", "Status", "Keterangan"]
        for i, c in enumerate(dcols, 1):
            wb3.cell(row=1, column=i, value=c)
        style_header(wb3, 1, len(dcols))
        rr = 2
        for rec in records:
            e = emps.get(rec["employee_id"], {})
            if team_id and rec.get("team_id") != team_id:
                continue
            vals = [
                rec["date"], e.get("nip"), e.get("nama"),
                teams.get(rec.get("team_id"), {}).get("name"),
                rec["status"], STATUS_LABEL.get(rec["status"])
            ]
            for i, v in enumerate(vals, 1):
                c = wb3.cell(row=rr, column=i, value=v)
                c.border = border
                if i == 5:
                    c.fill = PatternFill("solid", fgColor=STATUS_HEX.get(rec["status"], "FFFFFF"))
                    c.font = Font(color="FFFFFF", bold=True)
                    c.alignment = center
            rr += 1
        autofit(wb3, len(dcols))
        wb3.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"Rekap_Absensi_DAMKAR_{start}_{end}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )


@router.get("/export/pdf")
async def export_pdf(
    start: str,
    end: str,
    team_id: str = None,
    category: str = None,
    include_summary: bool = True,
    include_breakdown: bool = False,
    include_detail: bool = False,
    user: dict = Depends(get_current_user),
):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import (
        BaseDocTemplate, PageTemplate, Frame, Table, TableStyle,
        Paragraph, Spacer
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    data = await _compute_recap(start, end, team_id or None, category or None)
    buf = io.BytesIO()
    page = landscape(A4)
    doc = BaseDocTemplate(buf, pagesize=page, leftMargin=12 * mm, rightMargin=12 * mm,
                          topMargin=30 * mm, bottomMargin=18 * mm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    gen_time = datetime.now().strftime("%d-%m-%Y %H:%M")

    def header_footer(canvas, d):
        canvas.saveState()
        w, h = page
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawCentredString(w / 2, h - 14 * mm, KOP["l1"])
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawCentredString(w / 2, h - 19 * mm, KOP["l2"])
        canvas.setFont("Helvetica", 9)
        canvas.drawCentredString(w / 2, h - 23.5 * mm, KOP["l3"] + " — " + KOP["addr"])
        canvas.setLineWidth(1.2)
        canvas.line(12 * mm, h - 26 * mm, w - 12 * mm, h - 26 * mm)
        canvas.setFont("Helvetica-Oblique", 7.5)
        canvas.drawString(12 * mm, 10 * mm, "Dicetak dari Sistem Informasi Absensi DAMKAR")
        canvas.drawCentredString(w / 2, 10 * mm, f"Dicetak: {gen_time}")
        canvas.drawRightString(w - 12 * mm, 10 * mm, f"Halaman {d.page}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], fontSize=13, alignment=TA_CENTER, spaceAfter=2)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontSize=10, alignment=TA_CENTER, spaceAfter=2)
    sec_style = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=11, textColor=colors.HexColor("#0F172A"), spaceBefore=8, spaceAfter=4)

    elements = []
    elements.append(Paragraph("REKAPITULASI ABSENSI PEGAWAI", title_style))
    elements.append(Paragraph(f"Periode: {data['period_label']}", sub_style))
    elements.append(Spacer(1, 6))

    status_colors = {s: colors.HexColor("#" + STATUS_HEX[s]) for s in STATUSES}

    if include_summary:
        elements.append(Paragraph("RINGKASAN PERIODE", sec_style))
        gt = data["grand_total"]
        sum_data = [["Total Pegawai"] + [STATUS_LABEL[s] for s in STATUSES] + ["Total"],
                    [data["total_pegawai"]] + [gt[s] for s in STATUSES] + [sum(gt.values())]]
        st = Table(sum_data, repeatRows=1)
        st.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(st)
        elements.append(Spacer(1, 8))

        elements.append(Paragraph("REKAP PER PEGAWAI", sec_style))
        header = ["No", "NIP", "Nama", "Regu", "Kategori", "Jabatan"] + STATUSES + ["Total"]
        table_data = [header]
        for row in data["rows"]:
            table_data.append([
                row["no"], row["nip"], Paragraph(str(row["nama"]), styles["BodyText"]),
                row["regu"], row["category"], Paragraph(str(row["jabatan"]), styles["BodyText"])
            ] + [row[s] for s in STATUSES] + [row["total"]])
        total_row = ["", "", "TOTAL", "", "", ""] + [data["grand_total"][s] for s in STATUSES] + [sum(data["grand_total"].values())]
        table_data.append(total_row)
        colw = [9 * mm, 30 * mm, 46 * mm, 18 * mm, 20 * mm, 46 * mm] + [12 * mm] * 6 + [14 * mm]
        t = Table(table_data, colWidths=colw, repeatRows=1)
        ts = [
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (4, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("SPAN", (2, -1), (5, -1)),
        ]
        for i, s in enumerate(STATUSES):
            ts.append(("TEXTCOLOR", (6 + i, 1), (6 + i, -2), status_colors[s]))
            ts.append(("FONTNAME", (6 + i, 1), (6 + i, -2), "Helvetica-Bold"))
        t.setStyle(TableStyle(ts))
        elements.append(t)

    if include_breakdown and len(data["breakdown"]) > 0:
        elements.append(Paragraph("BREAKDOWN BULANAN (mengikuti histori regu per bulan)", sec_style))
        header = ["No", "Nama", "Regu", "Bulan"] + STATUSES + ["Total"]
        bd = [header]
        for b in data["breakdown"]:
            bd.append([b["no"], Paragraph(str(b["nama"]), styles["BodyText"]), b["regu"], b["month_label"]]
                      + [b[s] for s in STATUSES] + [b["total"]])
        colw = [10 * mm, 60 * mm, 28 * mm, 34 * mm] + [15 * mm] * 6 + [15 * mm]
        t = Table(bd, colWidths=colw, repeatRows=1)
        ts = [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94A3B8")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (4, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        for i, s in enumerate(STATUSES):
            ts.append(("TEXTCOLOR", (4 + i, 1), (4 + i, -1), status_colors[s]))
            ts.append(("FONTNAME", (4 + i, 1), (4 + i, -1), "Helvetica-Bold"))
        t.setStyle(TableStyle(ts))
        elements.append(t)

    if include_detail:
        elements.append(Paragraph("DETAIL ABSENSI", sec_style))
        db = await get_db()
        ey, em = int(end[:4]), int(end[5:7])
        sd = f"{start}-01"
        ed = f"{end}-{last_day_of_month(ey, em):02d}"
        q = db.table("attendance").select("*").gte("date", sd).lte("date", ed).order("date")
        records = await fetch_all(q)
        emps = {e["id"]: e for e in ((await db.table("employees").select("*").execute()).data or [])}
        teams = {t["id"]: t for t in ((await db.table("teams").select("*").execute()).data or [])}
        dh = [["Tanggal", "NIP", "Nama", "Regu", "Status"]]
        for rec in records:
            if team_id and rec.get("team_id") != team_id:
                continue
            e = emps.get(rec["employee_id"], {})
            dh.append([
                rec["date"], e.get("nip"), Paragraph(str(e.get("nama")), styles["BodyText"]),
                teams.get(rec.get("team_id"), {}).get("name"), rec["status"]
            ])
        t = Table(dh, colWidths=[24 * mm, 36 * mm, 70 * mm, 25 * mm, 20 * mm], repeatRows=1)
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94A3B8")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (4, 0), (4, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(t)

    doc.build(elements)
    buf.seek(0)
    fname = f"Rekap_Absensi_DAMKAR_{start}_{end}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )


@router.get("/export/kasubid/excel")
async def export_kasubid_excel(
    start: str,
    end: str,
    user: dict = Depends(require_roles("admin", "operator", "viewer", "kasubid")),
):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

    data = await _compute_kasubid_recap(start, end)
    wb = Workbook()
    thin = Side(style="thin", color="94A3B8")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    hf = PatternFill("solid", fgColor="0F172A")
    hfont = Font(bold=True, color="FFFFFF")
    center = Alignment(horizontal="center", vertical="center")

    def head(ws, cols, row=1):
        for i, c in enumerate(cols, 1):
            cell = ws.cell(row=row, column=i, value=c)
            cell.fill = hf
            cell.font = hfont
            cell.alignment = center
            cell.border = border

    ws = wb.active
    ws.title = "Ringkasan Kasubid"
    head(ws, ["No", "Nama", "Posisi"] + STATUSES + ["Total"])
    r = 2
    for i, p in enumerate(data["positions"], 1):
        vals = [i, p["nama"], p["label"]] + [p[s] for s in STATUSES] + [p["total"]]
        for j, v in enumerate(vals, 1):
            c = ws.cell(row=r, column=j, value=v)
            c.border = border
        r += 1
    for col in "ABCDEFGHIJK":
        ws.column_dimensions[col].width = 16

    ws2 = wb.create_sheet("Detail Bulanan")
    head(ws2, ["Nama", "Posisi", "Bulan"] + STATUSES + ["Total"])
    r = 2
    for p in data["positions"]:
        for mo in p["monthly"]:
            vals = [p["nama"], p["label"], mo["month_label"]] + [mo[s] for s in STATUSES] + [mo["total"]]
            for j, v in enumerate(vals, 1):
                c = ws2.cell(row=r, column=j, value=v)
                c.border = border
            r += 1
    for col in "ABCDEFGHIJ":
        ws2.column_dimensions[col].width = 16

    ws3 = wb.create_sheet("Detail Harian")
    head(ws3, ["Tanggal", "Nama", "Posisi", "Status", "Keterangan"])
    r = 2
    for d in data["detail"]:
        vals = [d["date"], d["nama"], d["label"], d["status"], STATUS_LABEL.get(d["status"])]
        for j, v in enumerate(vals, 1):
            c = ws3.cell(row=r, column=j, value=v)
            c.border = border
        r += 1
    for col in "ABCDE":
        ws3.column_dimensions[col].width = 20

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=Rekap_Kasubid_{start}_{end}.xlsx"}
    )


@router.get("/export/kasubid/pdf")
async def export_kasubid_pdf(
    start: str,
    end: str,
    user: dict = Depends(require_roles("admin", "operator", "viewer", "kasubid")),
):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    data = await _compute_kasubid_recap(start, end)
    buf = io.BytesIO()
    page = landscape(A4)
    doc = BaseDocTemplate(buf, pagesize=page, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=30 * mm, bottomMargin=16 * mm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="m")
    gen = datetime.now().strftime("%d-%m-%Y %H:%M")

    def hf(canvas, d):
        canvas.saveState()
        w, h = page
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawCentredString(w / 2, h - 13 * mm, KOP["l1"])
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawCentredString(w / 2, h - 18 * mm, KOP["l2"])
        canvas.setFont("Helvetica", 8.5)
        canvas.drawCentredString(w / 2, h - 22 * mm, KOP["l3"])
        canvas.line(14 * mm, h - 25 * mm, w - 14 * mm, h - 25 * mm)
        canvas.setFont("Helvetica-Oblique", 7.5)
        canvas.drawString(14 * mm, 9 * mm, "Dicetak dari Sistem Informasi Absensi DAMKAR")
        canvas.drawRightString(w - 14 * mm, 9 * mm, f"Halaman {d.page}  |  {gen}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="m", frames=[frame], onPage=hf)])
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], fontSize=13, alignment=TA_CENTER)
    sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=10, alignment=TA_CENTER)
    el = [
        Paragraph("REKAP ABSENSI KASUBID", title),
        Paragraph(f"Periode: {data['period_label']}", sub),
        Spacer(1, 8)
    ]
    header = ["No", "Nama", "Posisi"] + STATUSES + ["Total"]
    td = [header]
    for i, p in enumerate(data["positions"], 1):
        td.append([i, Paragraph(p["nama"], styles["BodyText"]), p["label"]] + [p[s] for s in STATUSES] + [p["total"]])
    t = Table(td, repeatRows=1, colWidths=[12 * mm, 80 * mm, 30 * mm] + [16 * mm] * 6 + [18 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (3, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    el.append(t)
    doc.build(el)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Rekap_Kasubid_{start}_{end}.pdf"}
    )
