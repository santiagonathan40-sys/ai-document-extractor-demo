export interface ExtractionResult {
  fileName: string;
  status: "Extracted" | "Failed";
  data: Record<string, string>;
  error?: string;
}

export interface UseCase {
  id: string;
  title: string;
  description: string;
  icon: string;
  fields: string[];
}
