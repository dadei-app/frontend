import { api } from '@dadei/ui/lib/api/http/client';
import { ENDPOINTS } from '@dadei/ui/lib/api/http/constants';
import { buildEndpoint } from './utils';
import { Person } from '@dadei/ui/types/models.types';

interface UpdatePersonData {
  name?: string;
  audio?: File;
  expected_text?: string;
}

export const personsApi = {
  /**
   * Get all persons in the network
   * GET /api/v1/persons
   */
  async getAll(): Promise<Person[]> {
    const { data } = await api.get<Person[]>(ENDPOINTS.PERSONS);
    return data;
  },

  /**
   * Get person by ID
   * GET /api/v1/persons/{person_id}
   */
  async getById(personId: string): Promise<Person> {
    const endpoint = buildEndpoint(ENDPOINTS.PERSON_BY_ID, { personId });
    const { data } = await api.get<Person>(endpoint);
    return data;
  },

  /**
   * Update person
   * PATCH /api/v1/persons/{person_id}
   */
  async update(personId: string, updateData: UpdatePersonData): Promise<Person> {
    const endpoint = buildEndpoint(ENDPOINTS.PERSON_BY_ID, { personId });

    const formData = new FormData();

    if (updateData.name !== undefined) {
      formData.append('name', updateData.name);
    }

    if (updateData.audio) {
      formData.append('audio', updateData.audio);
    }

    if (updateData.expected_text) {
      formData.append('expected_text', updateData.expected_text);
    }

    const { data } = await api.patch<Person>(endpoint, formData);

    return data;
  },

  /**
   * Delete person
   * DELETE /api/v1/persons/{person_id}
   */
  async delete(personId: string): Promise<void> {
    const endpoint = buildEndpoint(ENDPOINTS.PERSON_BY_ID, { personId });
    await api.delete(endpoint);
  },

};