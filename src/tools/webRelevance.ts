/** Narrow deterministic recovery for the physically observed checks/checkers
 * failure. This is not a general semantic classifier. Ambiguous results pass. */
export function unrelatedChecksResult(topic: string, evidence: string): boolean {
  const terms = topic.toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3 && !['search','check','online','newest','latest','please','what','with','that','have','does','there','apple'].includes(word)) ?? []
  if (!terms.length || !/personal checks|bank checks|printed checks|checkers/i.test(evidence)) return false
  return !terms.some(word => new RegExp(`\\b${word}\\b`, 'i').test(evidence))
}
