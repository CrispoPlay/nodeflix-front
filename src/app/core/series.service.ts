import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';
import { ApiResponse, Interaction, InteractionType, SerieDetail, SerieSummary } from './models';
import { resolvePosterUrl } from './poster-url';

@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly detailCache = new Map<number, Observable<SerieDetail>>();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService
  ) {}

  getPopulares(page = 1): Observable<SerieSummary[]> {
    return this.http
      .get<ApiResponse<SerieSummary[]>>(`${API_BASE_URL}/series/populares`, { params: { page } })
      .pipe(map((response) => this.normalizeSeries(response.data ?? [])));
  }

  searchSeries(query: string, page = 1): Observable<SerieSummary[]> {
    return this.http
      .get<ApiResponse<SerieSummary[]>>(`${API_BASE_URL}/series/buscar`, { params: { query, page } })
      .pipe(map((response) => this.normalizeSeries(response.data ?? [])));
  }

  getDetalles(idTmdb: number): Observable<SerieDetail> {
    if (!this.detailCache.has(idTmdb)) {
      const request$ = this.http
        .get<ApiResponse<SerieDetail>>(`${API_BASE_URL}/series/${idTmdb}`)
        .pipe(
          map((response) => this.normalizeSerie(response.data)),
          shareReplay(1)
        );

      this.detailCache.set(idTmdb, request$);
    }

    return this.detailCache.get(idTmdb)!;
  }

  getRecomendaciones(): Observable<SerieSummary[]> {
    return this.http
      .get<ApiResponse<SerieSummary[]>>(`${API_BASE_URL}/recomendaciones`, {
        headers: this.auth.authHeaders()
      })
      .pipe(map((response) => this.normalizeSeries(response.data ?? [])));
  }

  interact(idTmdb: number, tipoInteraccion: InteractionType): Observable<unknown> {
    return this.http.post(
      `${API_BASE_URL}/interacciones`,
      { idTmdb, tipoInteraccion },
      { headers: this.auth.authHeaders() }
    );
  }

  getInteracciones(): Observable<Interaction[]> {
    return this.http
      .get<ApiResponse<Interaction[]>>(`${API_BASE_URL}/interacciones`, {
        headers: this.auth.authHeaders()
      })
      .pipe(map((response) => response.data ?? []));
  }

  private normalizeSeries<T extends SerieSummary>(items: T[]): T[] {
    return items.map((item) => this.normalizeSerie(item));
  }

  private normalizeSerie<T extends SerieSummary>(item: T): T {
    return {
      ...item,
      poster: resolvePosterUrl(item.poster)
    };
  }
}
