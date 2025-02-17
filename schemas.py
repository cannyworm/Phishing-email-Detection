from pydantic import BaseModel
from typing import List

# สำหรับการส่งอีเมล 1 ฉบับ
class EmailRequest(BaseModel):
    email_text: str

# สำหรับการส่งอีเมลหลายฉบับ
class BatchEmailRequest(BaseModel):
    emails: List[str]

