import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideLogOut,
  LucidePlay,
  LucideSearch,
  LucideSparkles
} from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import { DEFAULT_GENRES } from '../../core/catalog';
import { InteractionType, SerieDetail, SerieSummary, SeriesRow as SeriesRowModel } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';
import { SeriesService } from '../../core/series.service';
import { SeriesCard } from '../../shared/series-card/series-card';
import { SeriesRow } from '../../shared/series-row/series-row';

@Component({
  selector: 'app-browse-page',
  imports: [
    CommonModule,
    FormsModule,
    SeriesCard,
    SeriesRow,
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideLogOut,
    LucidePlay,
    LucideSearch,
    LucideSparkles
  ],
  templateUrl: './browse-page.html'
})
export class BrowsePage implements OnInit {
  readonly loading = signal(true);
  readonly recommendations = signal<SerieSummary[]>([]);
  readonly heroRail = signal<SerieSummary[]>([]);
  readonly popular = signal<SerieSummary[]>([]);
  readonly history = signal<SerieSummary[]>([]);
  readonly watchlist = signal<SerieSummary[]>([]);
  readonly dislikedIds = signal<number[]>([]);
  readonly genreRows = signal<SeriesRowModel[]>([]);
  readonly hero = signal<SerieDetail | null>(null);
  readonly searchResults = signal<SerieSummary[]>([]);
  readonly status = signal('');
  readonly toast = signal('');

  searchTerm = '';

  @ViewChild('heroScroller') private readonly heroScroller?: ElementRef<HTMLDivElement>;

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
      const [recommendations, popular, interactionState] = await Promise.all([
        this.loadRecommendations(),
        firstValueFrom(this.series.getPopulares(1)),
        this.loadInteractionState()
      ]);

      this.dislikedIds.set(interactionState.dislikedIds);

      const visiblePopular = this.uniqueSeries(popular)
        .filter((serie) => !interactionState.dislikedIds.includes(serie.id_tmdb))
        .slice(0, 18);
      const genreRows = await this.loadGenreRows();
      const personalizedPool = this.personalizedPoolFrom(genreRows, interactionState.history, interactionState.watchlist, visiblePopular);
      const apiRecommendations = this.uniqueSeries(recommendations)
        .filter((serie) => !interactionState.dislikedIds.includes(serie.id_tmdb))
        .slice(0, 18);
      const apiIsFallbackTop = this.isSameRow(apiRecommendations, visiblePopular);
      const visibleRecommendations = apiIsFallbackTop
        ? personalizedPool.slice(0, 18)
        : this.uniqueSeries([...apiRecommendations, ...personalizedPool]).slice(0, 18);
      const heroRail = this.uniqueSeries([...visibleRecommendations, ...personalizedPool]).slice(0, 14);

      this.popular.set(visiblePopular);
      this.recommendations.set(visibleRecommendations);
      this.heroRail.set(heroRail);
      this.history.set(interactionState.history.slice(0, 12));
      this.watchlist.set(interactionState.watchlist.slice(0, 18));

      const heroCandidate = heroRail[0] ?? visibleRecommendations[0] ?? interactionState.history[0] ?? visiblePopular[0] ?? null;
      if (heroCandidate) {
        this.hero.set(await firstValueFrom(this.series.getDetalles(heroCandidate.id_tmdb)));
      }

      this.genreRows.set(genreRows);
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
    this.showToast(this.interactionMessage(event.type));

    if (event.type === 'QUIERE_VER') {
      this.watchlist.set(this.mergeSeries(this.watchlist(), event.serie));
    }

    if (event.type === 'NO_LE_GUSTA') {
      this.dislikedIds.set(Array.from(new Set([...this.dislikedIds(), event.serie.id_tmdb])));
      this.recommendations.set(this.recommendations().filter((serie) => serie.id_tmdb !== event.serie.id_tmdb));
      this.popular.set(this.popular().filter((serie) => serie.id_tmdb !== event.serie.id_tmdb));
      this.genreRows.set(
        this.genreRows().map((row) => ({
          ...row,
          items: row.items.filter((serie) => serie.id_tmdb !== event.serie.id_tmdb)
        }))
      );
    } else {
      this.recommendations.set((await this.loadRecommendations()).slice(0, 18));
    }

    const interactionState = await this.loadInteractionState();
    this.history.set(interactionState.history.slice(0, 12));
    this.watchlist.set(interactionState.watchlist.slice(0, 18));
    this.dislikedIds.set(interactionState.dislikedIds);
  }

  playHero(): void {
    const key = this.hero()?.youtube_key;
    if (key && /^[\w-]+$/.test(key)) {
      window.open(`https://www.youtube.com/watch?v=${key}`, '_blank', 'noopener');
    }
  }

  async selectHero(serie: SerieSummary): Promise<void> {
    try {
      this.hero.set(await firstValueFrom(this.series.getDetalles(serie.id_tmdb)));
    } catch {
      this.hero.set(serie as SerieDetail);
    }
  }

  scrollHeroRail(direction: 'left' | 'right'): void {
    const element = this.heroScroller?.nativeElement;
    if (!element) {
      return;
    }

    const distance = Math.max(320, element.clientWidth * 0.78);
    element.scrollBy({ left: direction === 'right' ? distance : -distance, behavior: 'smooth' });
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

  private async loadInteractionState(): Promise<{ history: SerieSummary[]; watchlist: SerieSummary[]; dislikedIds: number[] }> {
    try {
      const interactions = await firstValueFrom(this.series.getInteracciones());
      const history: SerieSummary[] = [];
      const watchlist: SerieSummary[] = [];
      const dislikedIds: number[] = [];

      for (const item of interactions.slice(0, 10)) {
        try {
          const detail = await firstValueFrom(this.series.getDetalles(item.id_tmdb));
          history.push(detail);

          if (item.interaccion === 'QUIERE_VER' || item.interaccion === 'ES_FAVORITA') {
            watchlist.push(detail);
          }
        } catch {
          history.push(item);

          if (item.interaccion === 'QUIERE_VER' || item.interaccion === 'ES_FAVORITA') {
            watchlist.push(item);
          }
        }

        if (item.interaccion === 'NO_LE_GUSTA') {
          dislikedIds.push(item.id_tmdb);
        }
      }

      return { history, watchlist, dislikedIds };
    } catch {
      return { history: [], watchlist: [], dislikedIds: [] };
    }
  }

  private async loadGenreRows(): Promise<SeriesRowModel[]> {
    const selected = this.onboarding.ensureGenres().length ? this.onboarding.ensureGenres() : DEFAULT_GENRES;
    const rows: SeriesRowModel[] = [];

    for (const genre of selected.slice(0, 4)) {
      const seen = new Set<number>();
      const items: SerieSummary[] = [];

      for (const query of genre.queries.slice(0, 6)) {
        try {
          const found = await firstValueFrom(this.series.searchSeries(query));
          for (const item of found.slice(0, 4)) {
            if (!seen.has(item.id_tmdb)) {
              seen.add(item.id_tmdb);
              items.push(item);
            }
          }
        } catch {
          continue;
        }
      }

      rows.push({
        title: `${genre.name} conectado a tus gustos`,
        items: items.filter((item) => !this.dislikedIds().includes(item.id_tmdb)).slice(0, 14),
        accent: genre.accent
      });
    }

    return rows;
  }

  private mergeSeries(items: SerieSummary[], serie: SerieSummary): SerieSummary[] {
    return [serie, ...items.filter((item) => item.id_tmdb !== serie.id_tmdb)];
  }

  private personalizedPoolFrom(
    genreRows: SeriesRowModel[],
    history: SerieSummary[],
    watchlist: SerieSummary[],
    popular: SerieSummary[]
  ): SerieSummary[] {
    const topIds = new Set(popular.slice(0, 10).map((serie) => serie.id_tmdb));
    const candidates = this.uniqueSeries([
      ...watchlist,
      ...history,
      ...genreRows.flatMap((row) => row.items)
    ]).filter((serie) => !this.dislikedIds().includes(serie.id_tmdb));
    const nonTop = candidates.filter((serie) => !topIds.has(serie.id_tmdb));

    return nonTop.length ? nonTop : candidates;
  }

  private uniqueSeries(items: SerieSummary[]): SerieSummary[] {
    const seen = new Set<number>();
    return items.filter((item) => {
      if (seen.has(item.id_tmdb)) {
        return false;
      }

      seen.add(item.id_tmdb);
      return true;
    });
  }

  private isSameRow(first: SerieSummary[], second: SerieSummary[]): boolean {
    if (!first.length || !second.length) {
      return false;
    }

    const firstIds = first.slice(0, 8).map((item) => item.id_tmdb);
    const secondIds = new Set(second.slice(0, 8).map((item) => item.id_tmdb));
    const overlap = firstIds.filter((id) => secondIds.has(id)).length;

    return overlap >= Math.min(5, firstIds.length);
  }

  private interactionMessage(type: InteractionType): string {
    const messages: Record<InteractionType, string> = {
      LE_GUSTA: 'Se guardo como gusto para tus recomendaciones.',
      ES_FAVORITA: 'Agregada a favoritos y Mi lista.',
      QUIERE_VER: 'Agregada a Mi lista.',
      NO_LE_GUSTA: 'Marcada como no me gusta.'
    };

    return messages[type];
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2400);
  }
}
