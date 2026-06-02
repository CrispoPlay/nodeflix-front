import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideLogOut, LucidePlay, LucideSearch, LucideSparkles } from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import { DEFAULT_GENRES } from '../../core/catalog';
import { InteractionType, SerieDetail, SerieSummary, SeriesRow as SeriesRowModel } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';
import { SeriesService } from '../../core/series.service';
import { SeriesCard } from '../../shared/series-card/series-card';
import { SeriesRow } from '../../shared/series-row/series-row';

@Component({
  selector: 'app-browse-page',
  imports: [CommonModule, FormsModule, SeriesCard, SeriesRow, LucideLogOut, LucidePlay, LucideSearch, LucideSparkles],
  templateUrl: './browse-page.html'
})
export class BrowsePage implements OnInit {
  readonly loading = signal(true);
  readonly recommendations = signal<SerieSummary[]>([]);
  readonly popular = signal<SerieSummary[]>([]);
  readonly history = signal<SerieSummary[]>([]);
  readonly genreRows = signal<SeriesRowModel[]>([]);
  readonly hero = signal<SerieDetail | null>(null);
  readonly searchResults = signal<SerieSummary[]>([]);
  readonly status = signal('');

  searchTerm = '';

  constructor(
    readonly auth: AuthService,
    private readonly onboarding: OnboardingService,
    private readonly series: SeriesService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading.set(true);
    this.status.set('');

    try {
      const [recommendations, popular, history] = await Promise.all([
        this.loadRecommendations(),
        firstValueFrom(this.series.getPopulares(1)),
        this.loadHistory()
      ]);

      this.recommendations.set(recommendations.slice(0, 18));
      this.popular.set(popular.slice(0, 18));
      this.history.set(history.slice(0, 12));

      const heroCandidate = recommendations[0] ?? popular[0] ?? history[0] ?? null;
      if (heroCandidate) {
        this.hero.set(await firstValueFrom(this.series.getDetalles(heroCandidate.id_tmdb)));
      }

      this.genreRows.set(await this.loadGenreRows());
    } catch {
      this.status.set('No se pudo conectar con el backend en http://localhost:3000.');
    } finally {
      this.loading.set(false);
    }
  }

  async search(): Promise<void> {
    const query = this.searchTerm.trim();
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    try {
      this.searchResults.set((await firstValueFrom(this.series.searchSeries(query))).slice(0, 10));
    } catch {
      this.searchResults.set([]);
    }
  }

  async onInteraction(event: { serie: SerieSummary; type: InteractionType }): Promise<void> {
    await this.onboarding.recordInteraction(event.serie, event.type);
    this.recommendations.set((await this.loadRecommendations()).slice(0, 18));
  }

  playHero(): void {
    const key = this.hero()?.youtube_key;
    if (key && /^[\w-]+$/.test(key)) {
      window.open(`https://www.youtube.com/watch?v=${key}`, '_blank', 'noopener');
    }
  }

  heroGenres(): string {
    return this.hero()?.generos?.map((genre) => genre.name).slice(0, 3).join(' / ') ?? '';
  }

  async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigate(['/']);
  }

  private async loadRecommendations(): Promise<SerieSummary[]> {
    try {
      return await firstValueFrom(this.series.getRecomendaciones());
    } catch {
      return await firstValueFrom(this.series.getPopulares(1));
    }
  }

  private async loadHistory(): Promise<SerieSummary[]> {
    try {
      const interactions = await firstValueFrom(this.series.getInteracciones());
      const details: SerieSummary[] = [];

      for (const item of interactions.slice(0, 10)) {
        try {
          details.push(await firstValueFrom(this.series.getDetalles(item.id_tmdb)));
        } catch {
          details.push(item);
        }
      }

      return details;
    } catch {
      return [];
    }
  }

  private async loadGenreRows(): Promise<SeriesRowModel[]> {
    const selected = this.onboarding.ensureGenres().length ? this.onboarding.ensureGenres() : DEFAULT_GENRES;
    const rows: SeriesRowModel[] = [];

    for (const genre of selected.slice(0, 4)) {
      const seen = new Set<number>();
      const items: SerieSummary[] = [];

      for (const query of genre.queries.slice(0, 2)) {
        try {
          const found = await firstValueFrom(this.series.searchSeries(query));
          for (const item of found.slice(0, 8)) {
            if (!seen.has(item.id_tmdb)) {
              seen.add(item.id_tmdb);
              items.push(item);
            }
          }
        } catch {
          continue;
        }
      }

      rows.push({ title: `${genre.name} conectado a tus gustos`, items: items.slice(0, 14), accent: genre.accent });
    }

    return rows;
  }
}
