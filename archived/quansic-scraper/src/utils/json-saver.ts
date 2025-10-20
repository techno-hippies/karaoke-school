import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

export class JsonSaver {
  private baseDir: string;
  
  constructor(baseDir: string = 'output') {
    this.baseDir = baseDir;
  }
  
  /**
   * Save JSON data to organized folder structure:
   * output/{isni}/{service}/data.json
   */
  async saveServiceData(
    isni: string, 
    service: 'quansic' | 'spotify' | 'genius' | 'mlc',
    data: any,
    filename?: string
  ): Promise<string> {
    // Create directory structure: output/{isni}/{service}/
    const dir = path.join(this.baseDir, isni, service);
    await fs.mkdir(dir, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const file = filename || `${service}_${timestamp}.json`;
    const filepath = path.join(dir, file);
    
    // Save JSON with pretty formatting
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    console.log(chalk.gray(`  💾 Saved to ${filepath}`));
    return filepath;
  }
  
  /**
   * Save individual items (like tracks or works)
   */
  async saveItems(
    isni: string,
    service: string,
    itemType: string,
    items: any[]
  ): Promise<string> {
    const dir = path.join(this.baseDir, isni, service);
    await fs.mkdir(dir, { recursive: true });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filepath = path.join(dir, `${itemType}_${timestamp}.json`);
    
    await fs.writeFile(filepath, JSON.stringify(items, null, 2));
    return filepath;
  }
}