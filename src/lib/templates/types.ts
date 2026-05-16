// Template definitions seed a bedsheet with realistic elements + splices.
// Element `key` is template-local; ports are addressed as (key, portIndex).

export type TemplateElementType = "cable" | "splitter" | "equipment" | "closure";

export type TemplateCableConfig = {
  fiberCount: number;
  colorScheme: string;
  moduleFiberCount?: number;
};

export type TemplateSplitterConfig = {
  ratio: string;
  inputCount: number;
  outputCount: number;
};

export type TemplateEquipmentConfig = {
  inputCount: number;
  outputCount: number;
};

export type TemplateClosureConfig = {
  inputCount: number;
  outputCount: number;
  trayCount: number;
};

export type TemplateElement =
  | { key: string; type: "cable"; label: string; positionX: number; positionY: number; config: TemplateCableConfig }
  | { key: string; type: "splitter"; label: string; positionX: number; positionY: number; config: TemplateSplitterConfig }
  | { key: string; type: "equipment"; label: string; positionX: number; positionY: number; config: TemplateEquipmentConfig }
  | { key: string; type: "closure"; label: string; positionX: number; positionY: number; config: TemplateClosureConfig };

export type TemplateSplice = {
  fromKey: string;
  fromPortIndex: number;
  toKey: string;
  toPortIndex: number;
  comment?: string;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  defaultProjectName: string;
  defaultBedsheetName: string;
  elements: TemplateElement[];
  splices: TemplateSplice[];
};

export function portsForElement(el: TemplateElement): number {
  switch (el.type) {
    case "cable":
      return el.config.fiberCount * 2;
    case "splitter":
      return el.config.inputCount + 1;
    case "equipment":
      return el.config.inputCount + el.config.outputCount;
    case "closure":
      return el.config.trayCount * (el.config.inputCount + el.config.outputCount);
  }
}
