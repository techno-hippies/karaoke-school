/**
 * BMI Songview Service
 * Handles BMI API calls via Akash service
 */

export interface BMIWriter {
  name: string;
  affiliation: string;
  ipi: string;
}

export interface BMIPublisher {
  name: string;
  affiliation: string;
  ipi: string;
  parent_publisher?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
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
  alternate_titles: string[];
}

export class BMIService {
  constructor(private bmiServiceUrl: string) {}

  /**
   * Search BMI by ISWC (corroboration/verification)
   */
  async searchByISWC(iswc: string): Promise<BMIWorkData | null> {
    try {
      console.log(`🔍 BMI: Searching by ISWC ${iswc}`);

      const response = await fetch(`${this.bmiServiceUrl}/search/iswc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iswc }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.log(`  ❌ BMI ISWC not found (${response.status})`);
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        console.log(`  ✅ BMI ISWC found: ${result.data.bmi_work_id}`);
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('BMI ISWC search error:', error);
      return null;
    }
  }

  /**
   * Search BMI by title and performer (ISWC discovery)
   */
  async searchByTitle(title: string, performer?: string): Promise<BMIWorkData | null> {
    try {
      console.log(`🔍 BMI: Searching "${title}"${performer ? ` by ${performer}` : ''}`);

      const response = await fetch(`${this.bmiServiceUrl}/search/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, performer }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.log(`  ❌ BMI title search failed (${response.status})`);
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        console.log(`  ✅ BMI found: ${result.data.title} (ISWC: ${result.data.iswc || 'none'})`);
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('BMI title search error:', error);
      return null;
    }
  }
}
