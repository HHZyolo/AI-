"""密码哈希与校验。

bcrypt 单向哈希，盐随哈希一并存储。哈希字符串长度固定（60 字节），
但 User.password_hash 字段留到 255 以兼容未来算法升级。
"""

import bcrypt


def hash_password(plain: str) -> str:
    """生成 bcrypt 哈希。返回字符串，便于直接入库。"""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """校验明文密码与哈希是否匹配。"""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
