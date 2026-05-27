"""ORM 模型集中导出。

database.init_db() 依赖此处的 import 触发模型注册到 Base.metadata。
新增模型后记得在这里导出。
"""

from app.models.character import Character
from app.models.user import User

__all__ = ["Character", "User"]
