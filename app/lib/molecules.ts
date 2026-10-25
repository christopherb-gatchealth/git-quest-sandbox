export type Status = 'pass' | 'warn' | 'fail'

export interface Molecule {
  id: string
  name: string
  smiles: string
  // Predicted probability of toxicity, from 0 to 1
  score: number
  status: Status
}

export const MOLECULES: Molecule[] = [
  { id: 'm1', name: 'Ethanol', smiles: 'CCO', score: 0.042, status: 'pass' },
  { id: 'm2', name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', score: 0.183, status: 'pass' },
  { id: 'm3', name: 'Paracetamol', smiles: 'CC(=O)NC1=CC=C(C=C1)O', score: 0.461, status: 'warn' },
  { id: 'm4', name: 'Benzene', smiles: 'C1=CC=CC=C1', score: 0.874, status: 'fail' },
]
