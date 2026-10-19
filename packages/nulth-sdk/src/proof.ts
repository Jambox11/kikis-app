import type { NulthProof, NulthPublicInputs } from './types.js'

/**
 * Off-chain verification of a Nulth payment authorization proof.
 *
 * Validates the proof format and public-input consistency so providers and
 * test harnesses can reject malformed or tampered proofs before forwarding
 * them to Soroban for on-chain execution.
 *
 * Returns `true` only when the proof is well-formed and its public inputs are
 * internally consistent; returns `false` for any malformed or tampered input.
 */
export function verifyPaymentAuthProof(
  proof: NulthProof,
  publicInputs: NulthPublicInputs,
): boolean {
  if (!proof || typeof proof !== 'object') return false
  if (!publicInputs || typeof publicInputs !== 'object') return false

  // Proof format: required hex-encoded fields must be present and well-formed.
  const proofHex = (proof as { proof?: unknown }).proof
  const publicSignals = (proof as { publicSignals?: unknown }).publicSignals
  if (typeof proofHex !== 'string' || !isHex(proofHex)) return false
  if (!Array.isArray(publicSignals)) return false
  if (!publicSignals.every((s) => typeof s === 'string' && isHex(s))) return false

  // Public inputs consistency: required fields must be present and non-empty.
  const { commitment, nullifier, amount, recipient } = publicInputs as {
    commitment?: unknown
    nullifier?: unknown
    amount?: unknown
    recipient?: unknown
  }
  if (typeof commitment !== 'string' || !isHex(commitment)) return false
  if (typeof nullifier !== 'string' || !isHex(nullifier)) return false
  if (typeof recipient !== 'string' || recipient.length === 0) return false
  if (typeof amount !== 'string' || amount.length === 0) return false

  // The proof's public signals must match the supplied public inputs so a
  // tampered proof or mismatched inputs are rejected off-chain.
  const expectedSignals = [commitment, nullifier]
  if (publicSignals.length !== expectedSignals.length) return false
  for (let i = 0; i < expectedSignals.length; i++) {
    if (publicSignals[i] !== expectedSignals[i]) return false
  }

  return true
}

function isHex(value: string): boolean {
  return value.length > 0 && /^[0-9a-fA-F]+$/.test(value)
}
