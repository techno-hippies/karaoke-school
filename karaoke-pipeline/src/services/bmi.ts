/**
 * BMI Songview Service Client
 * Fallback for ISWC discovery when Quansic doesn't have the work
 */

const BMI_SERVICE_URL = 'https://ijks3975r1citcnv92kd26b9ss.ingress.d3akash.cloud';

export interface BMIWriter {
  name: string;
  affiliation: string;
  ipi: string;
}

export interface BMIPublisher {
  name: string;
  affiliation: string;
  ipi: string;
}

export interface BMIWorkData {
  title: string;
  iswc: string | null;
  bmi_work_id: string | null;
  ascap_work_id: string | null;
  writers: BMIWriter[];
  publishers: BMIPublisher[];
  performers: string[];
  shares: Record<string, string>;
  status: 'RECONCILED' | 'UNDER_REVIEW' | null;
}

/**
 * Search BMI by title and performer
 * Returns ISWC if found
 */
export async function searchBMI(
  title: string,
  performer?: string
): Promise<BMIWorkData | null> {
  try {
    console.log(`  🔍 BMI fallback: "${title}"${performer ? ` by ${performer}` : ''}`);

    const response = await fetch(`${BMI_SERVICE_URL}/search/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, performer }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.log(`     ❌ Not found in BMI (${response.status})`);
      return null;
    }

    const result = await response.json();
    if (result.success && result.data) {
      const iswc = result.data.iswc;
      console.log(`     ✅ Found in BMI: ${result.data.title}${iswc ? ` (ISWC: ${iswc})` : ''}`);
      return result.data;
    }

    return null;
  } catch (error: any) {
    console.error(`     ❌ BMI search error: ${error.message}`);
    return null;
  }
}

/**
 * Check BMI service health
 */
export async function checkBMIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BMI_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
