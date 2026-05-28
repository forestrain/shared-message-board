from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def smtp_enabled() -> bool:
    return bool(settings.smtp_host.strip() and settings.smtp_from.strip())


def send_email(*, to_addr: str, subject: str, text_body: str, html_body: str | None = None) -> None:
    if not smtp_enabled():
        logger.debug("SMTP not configured, skip email to %s", to_addr)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_addr
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    host = settings.smtp_host.strip()
    port = settings.smtp_port
    user = settings.smtp_user.strip()
    password = settings.smtp_password

    try:
        if settings.smtp_use_tls:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                if user and password:
                    smtp.login(user, password)
                smtp.sendmail(settings.smtp_from, [to_addr], msg.as_string())
        else:
            with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
                if user and password:
                    smtp.login(user, password)
                smtp.sendmail(settings.smtp_from, [to_addr], msg.as_string())
    except Exception:
        logger.exception("Failed to send email to %s", to_addr)
        raise
