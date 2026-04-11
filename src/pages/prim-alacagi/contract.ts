/**
 * contract.ts
 * Backend ile olan TEK sözleşme burada olacak.
 */

export interface PrimCalculateRequest {
  rows: PrimRowRequest[];
}

export interface PrimRowRequest {
  id: string;
  principal: string;
  percent: string;
}

export interface PrimCalculateResponse {
  success: boolean;
  data?: {
    amounts: number[];
    total: number;
  };
  error?: string;
}

export interface LoadCalculationRequest {
  loadId: string;
}

export interface LoadCalculationResponse {
  name?: string;
  notes?: string;
  aciklama?: string;
  data?: PrimSavedData | string;
  brut_total?: number;
  net_total?: number;
}

export interface PrimSavedData {
  form?: PrimFormData;
  formValues?: PrimFormData;
  results?: PrimResultsData;
  data?: {
    form?: PrimFormData;
    results?: PrimResultsData;
  };
  rows?: PrimRowRequest[];
  brutInputForNet?: string;
  brut_total?: number;
  net_total?: number;
}

export interface PrimFormData {
  rows?: PrimRowRequest[];
  brutInputForNet?: string;
}

export interface PrimResultsData {
  total?: number;
  amounts?: number[];
  brutForNetConversion?: number;
  rows?: PrimRowRequest[];
}

export interface PrimSaveData {
  data: {
    form: PrimFormData;
    results: PrimResultsData;
  };
  brut_total: number;
  net_total: number;
  rows: Array<{
    index: number;
    principal: number;
    percent: number;
    amount: number;
  }>;
}
