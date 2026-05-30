import { checkCert, fetchCertInfo } from '../tasks/checkCert';
import type { CertWatch, CertEvent } from '../types';

export function useChecker() {
  const check = async (watch: CertWatch): Promise<{ event: CertEvent | null }> => {
    const event = await checkCert(watch);
    return { event };
  };

  return { check };
}
