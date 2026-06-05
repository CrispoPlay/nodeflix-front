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
  LucideRefreshCw,
  LucideSearch,
  LucideSparkles
} from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import { DEFAULT_GENRES, GENRE_OPTIONS } from '../../core/catalog';
import { InteractionType, SerieDetail, SerieSummary, SeriesRow as SeriesRowModel } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';
import { resolvePosterUrl } from '../../core/poster-url';
import { SeriesService } from '../../core/series.service';
import { SeriesCard } from '../../shared/series-card/series-card';
import { SeriesRow } from '../../shared/series-row/series-row';

// Palabras comunes en Talk Shows, Spin-offs y material de relleno
const JUNK_WORDS = [
  'talking', 'making of', 'extra', 'behind the scenes', 'special',
  'unfiltered', 'after show', 'revelations', 'entrevista', 'documentary', 'inside'
];

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
    LucideRefreshCw,
    LucideSearch,
    LucideSparkles
  ],
  templateUrl: './browse-page.html'
})
export class BrowsePage implements OnInit {
  readonly loading       = signal(true);
  readonly isRefreshing  = signal(false);
  readonly recommendations = signal<SerieSummary[]>([]);
  readonly heroRail      = signal<SerieSummary[]>([]);
  readonly popular       = signal<SerieSummary[]>([]);
  readonly history       = signal<SerieSummary[]>([]);
  readonly watchlist     = signal<SerieSummary[]>([]);
  readonly dislikedIds   = signal<number[]>([]);
  readonly genreRows     = signal<SeriesRowModel[]>([]);
  readonly hero          = signal<SerieDetail | null>(null);
  readonly searchResults = signal<SerieSummary[]>([]);
  readonly status        = signal('');
  readonly toast         = signal('');

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

  // ─────────────────────────────────────────────────────────────────────────
  // CARGA INICIAL COMPLETA
  // ─────────────────────────────────────────────────────────────────────────

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

      const visiblePopular = await this.hydrateMissingPosters(
        this.uniqueSeries(popular)
          .filter(s => !interactionState.dislikedIds.includes(s.id_tmdb))
          .slice(0, 18)
      );

      const genreRows = await this.loadGenreRows();

      const personalizedPool = this.personalizedPoolFrom(
        genreRows,
        interactionState.history,
        interactionState.watchlist,
        visiblePopular
      );

      const apiRecommendations = await this.hydrateMissingPosters(
        this.uniqueSeries(recommendations)
          .filter(s => !interactionState.dislikedIds.includes(s.id_tmdb))
          .slice(0, 18)
      );

      const apiIsFallbackTop = this.isSameRow(apiRecommendations, visiblePopular);

      const visibleRecommendations = await this.hydrateMissingPosters(
        apiIsFallbackTop
          ? personalizedPool.slice(0, 18)
          : this.uniqueSeries([...apiRecommendations, ...personalizedPool]).slice(0, 18)
      );

      const heroRail = await this.hydrateMissingPosters(
        this.uniqueSeries([...visibleRecommendations, ...personalizedPool]).slice(0, 14)
      );

      this.popular.set(visiblePopular);
      this.recommendations.set(visibleRecommendations);
      this.heroRail.set(heroRail);
      this.history.set(interactionState.history.slice(0, 12));
      this.watchlist.set(interactionState.watchlist.slice(0, 18));
      this.genreRows.set(genreRows);

      // Hero aleatorio entre los 5 primeros para que cada carga sea fresca
      const topCandidates = heroRail.slice(0, 5);
      const heroCandidate  =
        topCandidates.length > 0
          ? topCandidates[Math.floor(Math.random() * topCandidates.length)]
          : (visibleRecommendations[0] ??
             interactionState.history[0] ??
             visiblePopular[0] ??
             null);

      if (heroCandidate) {
        this.hero.set(await firstValueFrom(this.series.getDetalles(heroCandidate.id_tmdb)));
      }
    } catch {
      this.status.set('No se pudo conectar con el backend en http://localhost:3000.');
    } finally {
      this.loading.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESCO SUAVE — actualiza recomendaciones y filas de género sin
  // mostrar el spinner de carga completo ni desmontar la página
  // ─────────────────────────────────────────────────────────────────────────

  async refreshRecommendations(): Promise<void> {
    if (this.isRefreshing()) return;

    this.isRefreshing.set(true);

    try {
      // Ejecutar ambas en paralelo para minimizar el tiempo de espera
      const [newRecs, newGenreRows, interactionState] = await Promise.all([
        this.loadRecommendations(),
        this.loadGenreRows(),
        this.loadInteractionState()
      ]);

      // Actualizar disliked por si cambió mientras se refrescaba
      this.dislikedIds.set(interactionState.dislikedIds);

      const visibleRecs = await this.hydrateMissingPosters(
        this.uniqueSeries(newRecs)
          .filter(s => !interactionState.dislikedIds.includes(s.id_tmdb))
          .slice(0, 18)
      );

      const personalizedPool = this.personalizedPoolFrom(
        newGenreRows,
        interactionState.history,
        interactionState.watchlist,
        this.popular()
      );

      // Reconstruir hero rail con el pool fresco
      const newHeroRail = await this.hydrateMissingPosters(
        this.uniqueSeries([...visibleRecs, ...personalizedPool]).slice(0, 14)
      );

      this.recommendations.set(visibleRecs);
      this.genreRows.set(newGenreRows);
      this.heroRail.set(newHeroRail);

      // Rotar hero a uno aleatorio del nuevo rail
      const topCandidates = newHeroRail.slice(0, 5);
      if (topCandidates.length > 0) {
        const newHeroSummary = topCandidates[Math.floor(Math.random() * topCandidates.length)];
        try {
          this.hero.set(await firstValueFrom(this.series.getDetalles(newHeroSummary.id_tmdb)));
        } catch {
          // mantener el hero actual si falla
        }
      }

      this.showToast('Descubriendo nuevas recomendaciones…');
    } catch {
      this.showToast('No se pudo actualizar. Intenta de nuevo.');
    } finally {
      this.isRefreshing.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BÚSQUEDA
  // ─────────────────────────────────────────────────────────────────────────

  async search(): Promise<void> {
    const query = this.searchTerm.trim();
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    try {
      this.searchResults.set(
        (await firstValueFrom(this.series.searchSeries(query))).slice(0, 10)
      );
    } catch {
      this.searchResults.set([]);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERACCIONES
  // ─────────────────────────────────────────────────────────────────────────

  async onInteraction(event: { serie: SerieSummary; type: InteractionType }): Promise<void> {
    await this.onboarding.recordInteraction(event.serie, event.type);
    this.showToast(this.interactionMessage(event.type));

    if (event.type === 'QUIERE_VER') {
      this.watchlist.set(this.mergeSeries(this.watchlist(), event.serie));
    }

    if (event.type === 'NO_LE_GUSTA') {
      this.dislikedIds.set(Array.from(new Set([...this.dislikedIds(), event.serie.id_tmdb])));
      this.recommendations.set(this.recommendations().filter(s => s.id_tmdb !== event.serie.id_tmdb));
      this.popular.set(this.popular().filter(s => s.id_tmdb !== event.serie.id_tmdb));
      this.genreRows.set(
        this.genreRows().map(row => ({
          ...row,
          items: row.items.filter(s => s.id_tmdb !== event.serie.id_tmdb)
        }))
      );
    } else {
      this.recommendations.set(
        await this.hydrateMissingPosters((await this.loadRecommendations()).slice(0, 18))
      );
    }

    const interactionState = await this.loadInteractionState();
    this.history.set(interactionState.history.slice(0, 12));
    this.watchlist.set(interactionState.watchlist.slice(0, 18));
    this.dislikedIds.set(interactionState.dislikedIds);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HERO
  // ─────────────────────────────────────────────────────────────────────────

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
    if (!element) return;

    const distance = Math.max(320, element.clientWidth * 0.78);
    element.scrollBy({ left: direction === 'right' ? distance : -distance, behavior: 'smooth' });
  }

  heroGenres(): string {
    return this.hero()?.generos?.map(g => g.name).slice(0, 3).join(' / ') ?? '';
  }

  heroPosterUrl(): string | null {
    return resolvePosterUrl(this.hero()?.poster);
  }

  posterUrl(serie: SerieSummary): string | null {
    return resolvePosterUrl(serie.poster);
  }

  async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigate(['/']);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

  private async loadRecommendations(): Promise<SerieSummary[]> {
    try {
      return await firstValueFrom(this.series.getRecomendaciones());
    } catch {
      // Página aleatoria como fallback para variar incluso sin historial
      const page = 1 + Math.floor(Math.random() * 3);
      return await firstValueFrom(this.series.getPopulares(page));
    }
  }

  private async loadInteractionState(): Promise<{
    history: SerieSummary[];
    watchlist: SerieSummary[];
    dislikedIds: number[];
  }> {
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

  /**
   * RANDOM WALK EN EL CATÁLOGO FRONTAL
   *
   * Cada llamada:
   *   1. Mezcla géneros del usuario con 1-2 géneros de descubrimiento aleatorios
   *   2. Selecciona 4 géneros al azar del pool resultante
   *   3. Para cada género, elige 5 queries al azar (no siempre las primeras)
   *   4. Toma 1-2 resultados al azar de los primeros 6 de cada búsqueda
   *
   * Esto garantiza que cada refresh muestre una combinación única de series.
   */
  private async loadGenreRows(): Promise<SeriesRowModel[]> {
    const userGenres =
      this.onboarding.ensureGenres().length
        ? this.onboarding.ensureGenres()
        : DEFAULT_GENRES;

    // Géneros de descubrimiento: géneros del catálogo completo que el usuario
    // no seleccionó explícitamente — añade serendipia al feed
    const discoveryPool = GENRE_OPTIONS.filter(
      g => !userGenres.some(ug => ug.id === g.id)
    );
    const discoveryGenres = this.randomSample(discoveryPool, Math.min(2, discoveryPool.length));

    // Pool final: géneros del usuario + descubrimiento, elegir 4 al azar
    const allCandidates  = [...userGenres, ...discoveryGenres];
    const selectedGenres = this.randomSample(allCandidates, Math.min(4, allCandidates.length));

    const rows: SeriesRowModel[] = [];

    for (const genre of selectedGenres) {
      const seen  = new Set<number>();
      const items: SerieSummary[] = [];

      // Queries aleatorias del género (no siempre las primeras N)
      const randomQueries = this.randomSample(genre.queries, Math.min(5, genre.queries.length));

      for (const query of randomQueries) {
        try {
          const found = await firstValueFrom(this.series.searchSeries(query));

          // Filtrar material de relleno
          const cleanFound = found.filter(s => {
            const titleLower = s.titulo.toLowerCase();
            return !JUNK_WORDS.some(kw => titleLower.includes(kw));
          });

          // Tomar 1-2 resultados aleatorios del top-6 (no siempre los primeros 2)
          const topCandidates = cleanFound.slice(0, 6);
          const sampleSize    = 1 + Math.floor(Math.random() * 2); // 1 ó 2
          const sampled       = this.randomSample(topCandidates, Math.min(sampleSize, topCandidates.length));

          for (const item of sampled) {
            if (!seen.has(item.id_tmdb)) {
              seen.add(item.id_tmdb);
              items.push(item);
            }
          }
        } catch {
          continue;
        }
      }

      const visibleItems = await this.hydrateMissingPosters(
        items
          .filter(item => !this.dislikedIds().includes(item.id_tmdb))
          .slice(0, 14)
      );

      if (visibleItems.length > 0) {
        rows.push({
          title:  `${genre.name} · para ti`,
          items:  visibleItems,
          accent: genre.accent
        });
      }
    }

    return rows;
  }

  private async hydrateMissingPosters(items: SerieSummary[]): Promise<SerieSummary[]> {
    return Promise.all(
      items.map(async serie => {
        if (resolvePosterUrl(serie.poster)) return serie;

        try {
          const detail = await firstValueFrom(this.series.getDetalles(serie.id_tmdb));
          return {
            ...serie,
            poster:       detail.poster ?? serie.poster,
            descripcion:  serie.descripcion ?? detail.descripcion,
            youtube_key:  serie.youtube_key ?? detail.youtube_key,
            plataformas:  serie.plataformas?.length ? serie.plataformas : detail.plataformas
          };
        } catch {
          return serie;
        }
      })
    );
  }

  private mergeSeries(items: SerieSummary[], serie: SerieSummary): SerieSummary[] {
    return [serie, ...items.filter(i => i.id_tmdb !== serie.id_tmdb)];
  }

  private personalizedPoolFrom(
    genreRows:  SeriesRowModel[],
    history:    SerieSummary[],
    watchlist:  SerieSummary[],
    popular:    SerieSummary[]
  ): SerieSummary[] {
    const topIds    = new Set(popular.slice(0, 10).map(s => s.id_tmdb));
    const candidates = this.uniqueSeries([
      ...watchlist,
      ...history,
      ...genreRows.flatMap(row => row.items)
    ]).filter(s => !this.dislikedIds().includes(s.id_tmdb));
    const nonTop = candidates.filter(s => !topIds.has(s.id_tmdb));

    return nonTop.length ? nonTop : candidates;
  }

  private uniqueSeries(items: SerieSummary[]): SerieSummary[] {
    const seen = new Set<number>();
    return items.filter(item => {
      if (seen.has(item.id_tmdb)) return false;
      seen.add(item.id_tmdb);
      return true;
    });
  }

  private isSameRow(first: SerieSummary[], second: SerieSummary[]): boolean {
    if (!first.length || !second.length) return false;
    const firstIds  = first.slice(0, 8).map(i => i.id_tmdb);
    const secondIds = new Set(second.slice(0, 8).map(i => i.id_tmdb));
    const overlap   = firstIds.filter(id => secondIds.has(id)).length;
    return overlap >= Math.min(5, firstIds.length);
  }

  /**
   * Fisher-Yates shuffle aplicado via sort(rand) — toma `count` elementos
   * del array en orden aleatorio sin repetición.
   */
  private randomSample<T>(array: T[], count: number): T[] {
    return [...array].sort(() => Math.random() - 0.5).slice(0, count);
  }

  private interactionMessage(type: InteractionType): string {
    const messages: Record<InteractionType, string> = {
      LE_GUSTA:    'Se guardó como gusto para tus recomendaciones.',
      ES_FAVORITA: 'Agregada a favoritos y Mi lista.',
      QUIERE_VER:  'Agregada a Mi lista.',
      NO_LE_GUSTA: 'Marcada como no me gusta. No la volveremos a sugerir.'
    };
    return messages[type];
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2600);
  }
}