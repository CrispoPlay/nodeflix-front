import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_GENRES, GENRE_OPTIONS } from './catalog';
import { GenreOption, InteractionType, SerieDetail, SerieSummary } from './models';
import { SeriesService } from './series.service';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly genresKey = 'nodeflix_selected_genres';
  private readonly touchedKey = 'nodeflix_touched_series';

  readonly selectedGenres = signal<GenreOption[]>(this.readGenres());
  readonly touchedSeries = signal<number[]>(this.readTouchedSeries());
  readonly selectedCount = computed(() => this.selectedGenres().length);

  constructor(private readonly series: SeriesService) {}

  toggleGenre(genre: GenreOption): void {
    const exists = this.selectedGenres().some((item) => item.id === genre.id);
    const next = exists
      ? this.selectedGenres().filter((item) => item.id !== genre.id)
      : [...this.selectedGenres(), genre];

    this.selectedGenres.set(next);
    localStorage.setItem(this.genresKey, JSON.stringify(next.map((item) => item.id)));
  }

  ensureGenres(): GenreOption[] {
    const selected = this.selectedGenres();
    return selected.length ? selected : DEFAULT_GENRES;
  }

  async loadSeedSeries(limitPerGenre = 3, matchesPerQuery = 1): Promise<SerieSummary[]> {
    const seen = new Set<number>();
    const results: SerieSummary[] = [];
    const selected = this.ensureGenres();

    for (const genre of selected) {
      for (const query of genre.queries.slice(0, limitPerGenre)) {
        try {
          const found = await firstValueFrom(this.series.searchSeries(query));
          const ranked = this.rankSearchResults(query, found);

          for (const item of ranked.slice(0, matchesPerQuery)) {
            if (!seen.has(item.id_tmdb)) {
              seen.add(item.id_tmdb);
              results.push(item);
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (results.length) {
      return results;
    }

    return await firstValueFrom(this.series.getPopulares());
  }

  async loadDetailedCandidates(limit = 8): Promise<SerieDetail[]> {
    const summaries = await this.loadSeedSeries(12, 2);
    const details: SerieDetail[] = [];
    const fallback: SerieDetail[] = [];

    for (const summary of summaries.slice(0, limit * 5)) {
      if (details.length >= limit) {
        break;
      }

      try {
        const detail = await firstValueFrom(this.series.getDetalles(summary.id_tmdb));
        const enriched = { ...summary, ...detail };

        if (enriched.youtube_key) {
          details.push(enriched);
        } else {
          fallback.push(enriched);
        }
      } catch {
        fallback.push(summary as SerieDetail);
      }
    }

    return [...details, ...fallback].slice(0, limit);
  }

  async recordInteraction(serie: SerieSummary, type: InteractionType): Promise<void> {
    await firstValueFrom(this.series.interact(serie.id_tmdb, type));
    const next = Array.from(new Set([...this.touchedSeries(), serie.id_tmdb]));
    this.touchedSeries.set(next);
    localStorage.setItem(this.touchedKey, JSON.stringify(next));
  }

  private readGenres(): GenreOption[] {
    const raw = localStorage.getItem(this.genresKey);
    if (!raw) {
      return [];
    }

    try {
      const ids = JSON.parse(raw) as string[];
      return GENRE_OPTIONS.filter((genre) => ids.includes(genre.id));
    } catch {
      localStorage.removeItem(this.genresKey);
      return [];
    }
  }

  private readTouchedSeries(): number[] {
    const raw = localStorage.getItem(this.touchedKey);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as number[];
    } catch {
      localStorage.removeItem(this.touchedKey);
      return [];
    }
  }

  private rankSearchResults(query: string, results: SerieSummary[]): SerieSummary[] {
    const normalizedQuery = this.normalize(query);

    return [...results].sort((a, b) => {
      const aTitle = this.normalize(a.titulo);
      const bTitle = this.normalize(b.titulo);
      const aExact = aTitle === normalizedQuery ? 0 : 1;
      const bExact = bTitle === normalizedQuery ? 0 : 1;
      const aStarts = aTitle.startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = bTitle.startsWith(normalizedQuery) ? 0 : 1;
      const aPoster = a.poster ? 0 : 1;
      const bPoster = b.poster ? 0 : 1;

      return aExact - bExact || aStarts - bStarts || aPoster - bPoster;
    });
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
