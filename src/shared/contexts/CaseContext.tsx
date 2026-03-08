import { createContext, useContext, ReactNode, useState } from 'react';

interface Case {
  id: string;
  name: string;
  type: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

interface CaseContextType {
  cases: Case[];
  currentCase: Case | null;
  getCase: (id: string) => Promise<Case | null>;
  saveCase: (caseData: any) => Promise<Case>;
  deleteCase: (id: string) => Promise<void>;
  loading: boolean;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider = ({ children }: { children: ReactNode }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(false);

  // Örnek bir veri seti (gerçek uygulamada bir API'den çekilecek)
  const mockCases: Case[] = [
    {
      id: '1',
      name: 'Örnek Dava 1',
      type: 'fazla-mesai',
      data: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const getCase = async (id: string): Promise<Case | null> => {
    setLoading(true);
    try {
      // Gerçek bir API çağrısı yapılabilir
      // const response = await api.get(`/cases/${id}`);
      // return response.data;
      
      // Örnek veri kullanıyoruz
      const foundCase = mockCases.find(c => c.id === id) || null;
      setCurrentCase(foundCase);
      return foundCase;
    } catch (error) {
      console.error('Dava yüklenirken hata oluştu:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const saveCase = async (caseData: any): Promise<Case> => {
    setLoading(true);
    try {
      // Gerçek bir API çağrısı yapılabilir
      // const response = await (caseData.id ? api.put(`/cases/${caseData.id}`, caseData) : api.post('/cases', caseData));
      // return response.data;
      
      // Örnek veri kullanıyoruz
      const now = new Date().toISOString();
      let savedCase: Case;
      
      if (caseData.id) {
        // Güncelleme
        savedCase = {
          ...caseData,
          updatedAt: now,
        };
        setCases(cases.map(c => c.id === savedCase.id ? savedCase : c));
      } else {
        // Yeni kayıt
        savedCase = {
          ...caseData,
          id: Date.now().toString(),
          createdAt: now,
          updatedAt: now,
        };
        setCases([...cases, savedCase]);
      }
      
      setCurrentCase(savedCase);
      return savedCase;
    } catch (error) {
      console.error('Dava kaydedilirken hata oluştu:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteCase = async (id: string): Promise<void> => {
    setLoading(true);
    try {
      // Gerçek bir API çağrısı yapılabilir
      // await api.delete(`/cases/${id}`);
      
      // Örnek veri güncellemesi
      setCases(cases.filter(c => c.id !== id));
      if (currentCase?.id === id) {
        setCurrentCase(null);
      }
    } catch (error) {
      console.error('Dava silinirken hata oluştu:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    cases,
    currentCase,
    getCase,
    saveCase,
    deleteCase,
    loading,
  };

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
};

export const useCase = () => {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error('useCase hook\'u bir CaseProvider içinde kullanılmalıdır');
  }
  return context;
};
