from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, Field, field_validator, model_validator


class PerfilBase(BaseModel):
    nome: str
    data_nascimento: date | None = None
    telefone: str | None = None
    email: str | None = None


class PerfilCreate(PerfilBase):
    pass


class PerfilUpdate(BaseModel):
    nome: str | None = None
    data_nascimento: date | None = None
    telefone: str | None = None
    email: str | None = None


class PerfilOut(PerfilBase):
    uid: str
    atualizado_em: datetime | None = None


class TipoAgendamento(str, Enum):
    fixo = "fixo"
    intervalo = "intervalo"
    dias_semana = "dias_semana"


Horario = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
DiaSemana = Annotated[int, Field(ge=0, le=6)]


class Agendamento(BaseModel):
    tipo: TipoAgendamento = TipoAgendamento.fixo
    horarios: list[str] = Field(default_factory=list, description='Ex: ["08:00","20:00"]')
    intervalo_horas: int | None = Field(None, ge=1, le=72)
    dias_semana: list[int] = Field(default_factory=list, description="0=seg .. 6=dom")

    @field_validator("horarios", "dias_semana", mode="before")
    @classmethod
    def _nulo_vira_lista(cls, valor: Any) -> Any:
        return [] if valor is None else valor


class AgendamentoIn(Agendamento):
    horarios: list[Horario] = Field(default_factory=list, description='"HH:MM", ex: ["08:00","20:00"]')
    dias_semana: list[DiaSemana] = Field(default_factory=list, description="0=seg .. 6=dom")


class MedicamentoBase(BaseModel):
    nome: str
    dosagem: str | None = None
    forma_uso: str | None = Field(None, description="comprimido, gota, etc.")
    agendamento: Agendamento = Field(default_factory=Agendamento)
    periodo_inicio: date | None = None
    periodo_fim: date | None = None
    observacoes: str | None = None
    foto_url: str | None = Field(None, description="Foto da embalagem (RF05)")
    ativo: bool = True


class MedicamentoCreate(MedicamentoBase):
    agendamento: AgendamentoIn = Field(default_factory=AgendamentoIn)


class MedicamentoUpdate(BaseModel):
    nome: str | None = None
    dosagem: str | None = None
    forma_uso: str | None = None
    agendamento: AgendamentoIn | None = None
    periodo_inicio: date | None = None
    periodo_fim: date | None = None
    observacoes: str | None = None
    foto_url: str | None = None
    ativo: bool | None = None


class MedicamentoOut(MedicamentoBase):
    id: str
    criado_em: datetime | None = None
    atualizado_em: datetime | None = None


class StatusDose(str, Enum):
    pendente = "pendente"
    tomada = "tomada"
    nao_tomada = "nao_tomada"
    adiada = "adiada"


def _validar_adiada(status: StatusDose | None, novo_horario: datetime | None) -> None:
    if status == StatusDose.adiada and novo_horario is None:
        raise ValueError("status=adiada exige 'novo_horario'")


class DoseCreate(BaseModel):
    medicamento_id: str
    horario_previsto: datetime
    status: StatusDose = StatusDose.pendente
    novo_horario: datetime | None = Field(None, description="Obrigatorio quando status=adiada")

    @model_validator(mode="after")
    def _checar_adiada(self) -> DoseCreate:
        _validar_adiada(self.status, self.novo_horario)
        return self


class DoseUpdate(BaseModel):
    status: StatusDose | None = None
    horario_registrado: datetime | None = None
    novo_horario: datetime | None = Field(None, description="Obrigatorio quando status=adiada")

    @model_validator(mode="after")
    def _checar_adiada(self) -> DoseUpdate:
        _validar_adiada(self.status, self.novo_horario)
        return self


class DoseOut(BaseModel):
    id: str
    medicamento_id: str
    horario_previsto: datetime
    status: StatusDose = StatusDose.pendente
    horario_registrado: datetime | None = None
    novo_horario: datetime | None = None
    criado_em: datetime | None = None
    atualizado_em: datetime | None = None


class OrientacaoBase(BaseModel):
    medicamento_id: str
    texto: str
    validade: date | None = Field(None, description="Periodo de validade (RF13)")
    concluida: bool = False


class OrientacaoCreate(OrientacaoBase):
    pass


class OrientacaoUpdate(BaseModel):
    texto: str | None = None
    validade: date | None = None
    concluida: bool | None = None


class OrientacaoOut(OrientacaoBase):
    id: str
    criado_em: datetime | None = None
    atualizado_em: datetime | None = None
