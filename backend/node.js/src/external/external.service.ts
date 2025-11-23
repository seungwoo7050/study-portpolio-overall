import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom, retry, timeout } from 'rxjs';

export interface ExternalDataResponse {
  id: number;
  title: string;
  body: string;
  userId: number;
}

@Injectable()
export class ExternalService {
  private readonly logger = new Logger(ExternalService.name);
  private readonly TIMEOUT_MS = 5000; // 5 seconds
  private readonly MAX_RETRIES = 3;
  private readonly EXTERNAL_API_URL = 'https://jsonplaceholder.typicode.com';

  constructor(private httpService: HttpService) {}

  /**
   * Fetch example data from external API with timeout and retry logic
   */
  async fetchExampleData(): Promise<ExternalDataResponse[]> {
    const url = `${this.EXTERNAL_API_URL}/posts`;

    this.logger.log(`Fetching data from external API: ${url}`);

    try {
      const observable = this.httpService.get<ExternalDataResponse[]>(url).pipe(
        timeout(this.TIMEOUT_MS),
        retry({
          count: this.MAX_RETRIES,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Request failed (attempt ${retryCount}/${this.MAX_RETRIES}): ${error.message}`,
            );
            // Exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, retryCount - 1) * 1000;
            return new Promise((resolve) => setTimeout(resolve, delayMs));
          },
        }),
        catchError((error: AxiosError) => {
          this.logger.error(
            `External API call failed after ${this.MAX_RETRIES} retries: ${error.message}`,
            error.stack,
          );
          throw error;
        }),
      );

      const response = await firstValueFrom(observable);
      this.logger.log(`Successfully fetched ${response.data.length} items from external API`);

      // Return first 10 items
      return response.data.slice(0, 10);
    } catch (error) {
      this.logger.error('External API call failed, returning fallback response', error.stack);

      // Fallback response
      return [
        {
          id: -1,
          title: 'Fallback Data',
          body: 'The external API is currently unavailable. This is a fallback response.',
          userId: 0,
        },
      ];
    }
  }

  /**
   * Fetch a single post by ID
   */
  async fetchPostById(id: number): Promise<ExternalDataResponse | null> {
    const url = `${this.EXTERNAL_API_URL}/posts/${id}`;

    this.logger.log(`Fetching post ${id} from external API`);

    try {
      const observable = this.httpService.get<ExternalDataResponse>(url).pipe(
        timeout(this.TIMEOUT_MS),
        retry({
          count: this.MAX_RETRIES,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Request failed (attempt ${retryCount}/${this.MAX_RETRIES}): ${error.message}`,
            );
            const delayMs = Math.pow(2, retryCount - 1) * 1000;
            return new Promise((resolve) => setTimeout(resolve, delayMs));
          },
        }),
        catchError((error: AxiosError) => {
          this.logger.error(
            `External API call failed after ${this.MAX_RETRIES} retries: ${error.message}`,
            error.stack,
          );
          throw error;
        }),
      );

      const response = await firstValueFrom(observable);
      this.logger.log(`Successfully fetched post ${id} from external API`);

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch post ${id}, returning null`, error.stack);
      return null;
    }
  }
}
