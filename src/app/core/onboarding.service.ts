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

  async loadSeedSeries(limitPerGenre = 3): Promise<SerieSummary[]> {
    const seen = new Set<number>();
    const results: SerieSummary[] = [];
    const selected = this.ensureGenres();

    for (const genre of selected) {
      for (const query of genre.queries.slice(0, limitPerGenre)) {
        try {
          const found = await firstValueFrom(this.series.searchSeries(query));
          for (const item of found.slice(0, 4)) {
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
    const summaries = await this.loadSeedSeries(2);
    const details: SerieDetail[] = [];

    for (const summary of summaries.slice(0, limit * 2)) {
      if (details.length >= limit) {
        break;
      }

      try {
        const detail = await firstValueFrom(this.series.getDetalles(summary.id_tmdb));
        details.push({ ...summary, ...detail });
      } catch {
        details.push(summary as SerieDetail);
      }
    }

    return details;
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
}
