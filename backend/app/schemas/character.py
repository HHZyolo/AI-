"""角色相关 Pydantic schema —— F05。

设计原则:
- 公开 schema (CharacterPublic) 只暴露展示字段,绝不输出 system_prompt / voice_id /
  voice_provider —— 这些是后端机密,落地页/H5 不需要也不应该看到。
- traits 在 ORM 里存 CSV,这里 from_attributes 时由 validator 切成 list[str],
  前端直接拿 list 用。
"""

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class CharacterPublic(BaseModel):
    """对外公开的角色信息。给落地页 / H5 角色选择页使用。"""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    slug: str = Field(..., description="角色稳定标识,前端路由/选择态用它,不要用 id")
    name: str
    age: str
    persona: str = Field(..., description="一句话人设")
    call: str = Field(..., description="角色对用户的称呼,如「哥哥」")
    quote: str = Field(..., description="代表台词,用于卡片展示")
    # 序列化时输出 "traits";from_attributes 时从 ORM 的 traits_csv 取值
    traits: list[str] = Field(
        ...,
        description="3 个性格标签",
        validation_alias=AliasChoices("traits", "traits_csv"),
    )
    accent: str = Field(..., description="CSS 主题色 token,如 var(--accent)")
    greeting: str = Field(..., description="接通后的第一句话")

    @field_validator("traits", mode="before")
    @classmethod
    def _split_traits(cls, v: object) -> object:
        """ORM 里 traits 存的是 CSV,这里切成 list。已是 list 时原样返回。"""
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return v


class CharacterList(BaseModel):
    """角色列表响应。包一层方便后续加分页 / total。"""

    items: list[CharacterPublic]
