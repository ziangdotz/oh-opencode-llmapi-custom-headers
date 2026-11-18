export interface EditorOptions {
  title: string;
  description?: string;
  value: string;
  rows: number;
  validate: (value: string) => void;
  onDraft?: (value: string) => void;
}
