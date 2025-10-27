/**
 * GraphQL Client for querying GRC-20 knowledge graph
 *
 * The Graph indexes GRC-20 spaces and exposes them via GraphQL.
 */

import { config } from '../config';

export interface GRC20Entity {
  id: string;
  name: string;
  description?: string;
  types: string[];
  properties: Array<{
    property: { id: string; name: string };
    value: string;
  }>;
  relations: Array<{
    property: { id: string; name: string };
    target: { id: string; name: string };
  }>;
}

export class GRC20GraphQLClient {
  private endpoint: string;

  constructor(spaceId: string) {
    this.endpoint = `${config.graphApiOrigin}/space/${spaceId}/graphql`;
  }

  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.statusText}`);
    }

    const { data, errors } = await response.json();

    if (errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
    }

    return data;
  }

  // ============ Query Helpers ============

  async getEntityById(id: string): Promise<GRC20Entity | null> {
    const data = await this.query<{ entity: GRC20Entity }>(
      `
        query GetEntity($id: ID!) {
          entity(id: $id) {
            id
            name
            description
            types
            properties {
              property { id, name }
              value
            }
            relations {
              property { id, name }
              target { id, name }
            }
          }
        }
      `,
      { id }
    );

    return data.entity;
  }

  async searchByProperty(propertyName: string, value: string): Promise<GRC20Entity[]> {
    const data = await this.query<{ entities: GRC20Entity[] }>(
      `
        query SearchByProperty($propertyName: String!, $value: String!) {
          entities(
            where: {
              properties_some: {
                property_: { name: $propertyName }
                value: $value
              }
            }
          ) {
            id
            name
            description
            types
            properties {
              property { id, name }
              value
            }
            relations {
              property { id, name }
              target { id, name }
            }
          }
        }
      `,
      { propertyName, value }
    );

    return data.entities;
  }

  async getEntitiesByType(typeName: string, limit = 10): Promise<GRC20Entity[]> {
    const data = await this.query<{ entities: GRC20Entity[] }>(
      `
        query GetEntitiesByType($typeName: String!, $limit: Int!) {
          entities(
            where: { types_contains: [$typeName] }
            first: $limit
          ) {
            id
            name
            description
            types
            properties {
              property { id, name }
              value
            }
            relations {
              property { id, name }
              target { id, name }
            }
          }
        }
      `,
      { typeName, limit }
    );

    return data.entities;
  }

  // ============ Music-Specific Queries ============

  async getWorkBySpotifyId(spotifyId: string): Promise<GRC20Entity | null> {
    const entities = await this.searchByProperty('Spotify ID', spotifyId);
    return entities[0] || null;
  }

  async getWorkByISWC(iswc: string): Promise<GRC20Entity | null> {
    const entities = await this.searchByProperty('ISWC', iswc);
    return entities[0] || null;
  }

  async getWorkByMBID(mbid: string): Promise<GRC20Entity | null> {
    const entities = await this.searchByProperty('MusicBrainz ID', mbid);
    return entities[0] || null;
  }

  async getSegmentsByWork(workId: string): Promise<GRC20Entity[]> {
    const data = await this.query<{ entity: { relations: Array<{ target: GRC20Entity }> } }>(
      `
        query GetSegmentsByWork($workId: ID!) {
          entity(id: $workId) {
            relations(where: { property_: { name: "Has Segment" } }) {
              target {
                id
                name
                types
                properties {
                  property { id, name }
                  value
                }
              }
            }
          }
        }
      `,
      { workId }
    );

    return data.entity?.relations?.map(r => r.target) || [];
  }

  async getAllWorks(limit = 100): Promise<GRC20Entity[]> {
    return this.getEntitiesByType('Musical Work', limit);
  }

  async getAllSegments(limit = 100): Promise<GRC20Entity[]> {
    return this.getEntitiesByType('Karaoke Segment', limit);
  }
}

// ============ Helper Functions ============

export function getPropertyValue(entity: GRC20Entity, propertyName: string): string | null {
  const prop = entity.properties.find(p => p.property.name === propertyName);
  return prop?.value || null;
}

export function getRelatedEntities(entity: GRC20Entity, relationName: string): Array<{ id: string; name: string }> {
  return entity.relations
    .filter(r => r.property.name === relationName)
    .map(r => r.target);
}

// ============ Export singleton ============

export function createClient(spaceId?: string): GRC20GraphQLClient {
  const id = spaceId || config.spaceId;
  if (!id) {
    throw new Error('No spaceId provided and GRC20_SPACE_ID not set');
  }
  return new GRC20GraphQLClient(id);
}
