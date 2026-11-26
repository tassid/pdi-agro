import { useMemo, useState } from 'react'
import type { RGB } from './lib/img'
import { makeField, makeLeaf, makeSeeds, type Doenca } from './lib/synth'

export const W = 360, H = 240

const cache = new Map<string, unknown>()
export function memo<T>(key: string, f: () => T): T {
  if (!cache.has(key)) cache.set(key, f())
  return cache.get(key) as T
}

export const field = (seed: number, cobertura = 0.55, daninhas = 30, estresse = 0.6, espacamento = 24) =>
  memo(`f${seed}-${cobertura}-${daninhas}-${estresse}-${espacamento}`, () => makeField(W, H, seed, { cobertura, daninhas, estresse, espacamento }))
export const leaf = (seed: number, doenca: Doenca = 'ferrugem', severidade = 0.5, fundo: 'claro' | 'solo' | 'escuro' = 'claro') =>
  memo(`l${seed}-${doenca}-${severidade}-${fundo}`, () => makeLeaf(W, H, seed, { doenca, severidade, fundo }))
export const seeds = (seed: number, n = 40) => memo(`s${seed}-${n}`, () => makeSeeds(W, H, seed, { n }))

export const SAMPLE_NAMES = ['lavoura', 'folha', 'sementes'] as const
export type SampleName = (typeof SAMPLE_NAMES)[number] | 'minha foto'

export function sampleRGB(name: SampleName, seed: number, upload: RGB | null): RGB {
  if (name === 'minha foto' && upload) return upload
  if (name === 'folha') return leaf(seed, (['ferrugem', 'mancha-alvo', 'clorose'] as Doenca[])[seed % 3], 0.55).rgb
  if (name === 'sementes') return seeds(seed).rgb
  return field(seed).rgb
}

/** estado padrão de um lab que aceita exemplo, sorteio e foto do aluno */
export function useSource(initial: SampleName = 'lavoura') {
  const [name, setName] = useState<SampleName>(initial)
  const [seed, setSeed] = useState(1)
  const [upload, setUpload] = useState<RGB | null>(null)
  const img = useMemo(() => sampleRGB(name, seed, upload), [name, seed, upload])
  const samples = upload ? ([...SAMPLE_NAMES, 'minha foto'] as const) : SAMPLE_NAMES
  return {
    img,
    name,
    seed,
    pickerProps: {
      samples: samples as readonly string[],
      value: name as string,
      onChange: (v: string) => setName(v as SampleName),
      onShuffle: () => setSeed((s) => s + 1),
      onUpload: (i: RGB) => setUpload(i),
    },
  }
}
