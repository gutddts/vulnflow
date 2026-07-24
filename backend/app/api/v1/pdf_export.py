"""报告导出 API —— 生成真实 PDF 文件下载

PDF 自动检测 Windows 系统字体（微软雅黑/黑体）支持中文。
Linux/macOS 回退到 Helvetica ASCII 渲染。
"""

from __future__ import annotations

import re
import io
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from fpdf import FPDF, FPDFException

router = APIRouter(prefix="/reports", tags=["reports"])

class PDFReportRequest(BaseModel):
    title: str = Field(default="Penetration Test Report")
    content: str = Field(default="", description="Markdown report content")
    target: str = Field(default="", description="Target")


def _find_cjk_font():
    """查找系统中的中文字体"""
    candidates = [
        # Windows
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\SIMHEI.TTF",
        r"C:\Windows\Fonts\SIMKAI.TTF",
        r"C:\Windows\Fonts\Deng.ttf",
        # Linux
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if os.path.exists(p) and os.path.getsize(p) > 50000:
            return ('YaHei', p) if 'YaHei' in p or 'msyh' in p or 'MSYH' in p else \
                   ('SimHei', p) if 'hei' in p.lower() else \
                   ('SimSun', p) if 'song' in p.lower() or 'simsun' in p.lower() else \
                   ('CJK', p)
    return None, None


def _ascii_clean(s: str) -> str:
    """清理文本（PDF 渲染用，支持 Unicode 字体时保持原样）"""
    if not s:
        return ''
    s = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', s)
    return s


def _to_filename(s: str) -> str:
    """文件名：仅 ASCII（HTTP 头要求）"""
    s = re.sub(r'[^\x20-\x7e]+', '_', s)  # 非 ASCII → _
    s = re.sub(r'[\\/:*?"<>|]+', '_', s)
    s = re.sub(r'_+', '_', s)
    s = s.strip('_. ')
    return s or 'report'


class VulnFlowPDF(FPDF):
    """VulnFlow 报告 PDF（自动检测中文字体）"""

    def __init__(self):
        super().__init__()
        self._cn_font_name, self._cn_font_path = _find_cjk_font()
        self._has_cjk = self._cn_font_name is not None
        if self._has_cjk:
            try:
                self.add_font(self._cn_font_name, '', self._cn_font_path)
                self._main_font = self._cn_font_name
            except Exception:
                self._main_font = 'Helvetica'
                self._has_cjk = False
        else:
            self._main_font = 'Helvetica'

    def header(self):
        if self.page_no() > 1:
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(120, 120, 120)
            self._mc('VulnFlow Penetration Test Report', align='C', h=5)
            self.ln(8)
            self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(120, 120, 120)
        self.cell(self.w - self.l_margin - self.r_margin, 8,
                  f'Page {self.page_no()}/{{nb}}', align='L')
        self.cell(0, 8, datetime.now().strftime('%Y-%m-%d %H:%M'), align='R')

    def _mc(self, text: str, h: float = 6, font_size: int = 10, style: str = '', align: str = 'L'):
        """安全输出文本（自动使用中文字体）"""
        if not text:
            return
        self.set_x(self.l_margin)
        safe = _ascii_clean(text)
        if not safe:
            return
        font_name = self._main_font
        # CJK 字体不支持 Bold/Italic 变体（仅加载了 Regular），去掉 style
        actual_style = '' if self._has_cjk else style
        self.set_font(font_name, actual_style, font_size)
        try:
            self.multi_cell(self.w - self.l_margin - self.r_margin, h, safe, align=align)
        except FPDFException:
            # 如果字体不支持，降级到 Helvetica
            if font_name != 'Helvetica':
                self.set_font('Helvetica', style, font_size)
                self.multi_cell(self.w - self.l_margin - self.r_margin, h, safe.encode('ascii', 'replace'), align=align)
            else:
                self.multi_cell(self.w - self.l_margin - self.r_margin, h, safe[:200], align=align)

    def _space(self, needed: float):
        if self.get_y() + needed > self.h - self.b_margin:
            self.add_page()


def _md_to_blocks(md: str):
    """Markdown → 块列表"""
    blocks = []
    for raw in md.split('\n'):
        if not raw.strip():
            blocks.append((0, ''))
            continue
        m = re.match(r'^(#{1,6})\s+(.+)$', raw)
        if m:
            blocks.append((len(m.group(1)), m.group(2).strip()))
            continue
        if raw.startswith('```'):
            blocks.append((0, ''))
            continue
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', raw)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'`(.+?)`', r'\1', text)
        text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
        text = re.sub(r'^\s*[-*]\s+', '  - ', text)
        text = re.sub(r'^\s*\d+\.\s+', '', text)
        blocks.append((0, text))
    return blocks


@router.post("/export-pdf")
async def export_pdf(req: PDFReportRequest) -> StreamingResponse:
    """生成 PDF 报告并流式返回"""
    try:
        pdf = VulnFlowPDF()
        pdf.alias_nb_pages()
        pdf.set_margins(left=20, top=20, right=20)
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        cn_warn = ''  # 中文不可用时的提示

        # 封面
        pdf.set_text_color(0, 80, 100)
        pdf._mc(req.title or 'VulnFlow Report', h=12, font_size=20, style='B', align='C')
        pdf.ln(4)
        pdf.set_text_color(80, 80, 80)
        if req.target:
            pdf._mc(f"Target: {req.target}", h=6, font_size=10, align='C')
            pdf.ln(1)
        pdf._mc(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", h=6, font_size=10, align='C')
        pdf.ln(8)

        # 内容
        pdf.set_text_color(0, 0, 0)
        blocks = _md_to_blocks(req.content or '(No content)')

        for level, text in blocks:
            pdf.set_x(pdf.l_margin)
            if level == 1:
                pdf._space(15)
                pdf.ln(6)
                pdf.set_text_color(0, 80, 100)
                pdf._mc(text, h=10, font_size=16, style='B')
                pdf.set_text_color(0, 0, 0)
            elif level == 2:
                pdf._space(12)
                pdf.ln(4)
                pdf.set_text_color(20, 60, 80)
                pdf._mc(text, h=8, font_size=13, style='B')
                pdf.set_text_color(0, 0, 0)
            elif level == 3:
                pdf._space(10)
                pdf.ln(2)
                pdf.set_text_color(40, 40, 40)
                pdf._mc(text, h=7, font_size=11, style='B')
                pdf.set_text_color(0, 0, 0)
            else:
                if not text:
                    pdf.ln(2)
                else:
                    pdf._space(8)
                    pdf._mc(text, h=5.5, font_size=10)

        # 落款
        pdf._space(20)
        pdf.ln(10)
        pdf.set_text_color(120, 120, 120)
        pdf.set_font('Helvetica', 'I', 9)
        pdf.cell(0, 6, '---', align='C')
        pdf.ln(7)
        pdf.cell(0, 6, 'Generated by VulnFlow AI Platform', align='C')
        pdf.ln(6)
        pdf.cell(0, 6, 'VulnFlow Project - AI Penetration Testing Platform', align='C')

        # 输出 bytes
        out = pdf.output(dest='S')
        pdf_bytes = out.encode('latin-1', 'replace') if isinstance(out, str) else bytes(out) if isinstance(out, bytearray) else out

        # 文件名（HTTP 头只支持 ASCII）
        safe_name = _to_filename(req.title) or 'report'
        pdf_filename = f"{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{pdf_filename}"',
                'Content-Length': str(len(pdf_bytes)),
            },
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF 生成失败: {e}")
