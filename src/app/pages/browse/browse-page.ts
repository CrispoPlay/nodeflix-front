import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideBookmark,
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideHeart,
  LucideLogOut,
  LucidePlay,
  LucideRefreshCw,
  LucideSearch,
  LucideSparkles,
  LucideStar,
  LucideX
} from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import { DEFAULT_GENRES, GENRE_OPTIONS } from '../../core/catalog';
import { InteractionType, SerieDetail, SerieSummary, SeriesRow as SeriesRowModel } from '../../core/models';
import { OnboardingService } from '../../core/onboarding.service';
import { resolvePosterUrl } from '../../core/poster-url';
import { SeriesService } from '../../core/series.service';
import { SeriesCard } from '../../shared/series-card/series-card';
import { SeriesRow } from '../../shared/series-row/series-row';
import { SeriesDetailModal } from '../../shared/series-detail-modal/series-detail-modal';

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
    SeriesDetailModal,
    LucideBookmark,
    LucideCheck,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideHeart,
    LucideLogOut,
    LucidePlay,
    LucideRefreshCw,
    LucideSearch,
    LucideSparkles,
    LucideStar,
    LucideX
  ],
  templateUrl: './browse-page.html'
})
export class BrowsePage implements OnInit {
  readonly loading       = signal(true);
  readonly isRefreshing  = signal(false);
  
  // 🌟 ESTADOS DE SERIES
  readonly recommendations = signal<SerieSummary[]>([]);
  readonly heroRail      = signal<SerieSummary[]>([]);
  readonly popular       = signal<SerieSummary[]>([]);
  readonly history       = signal<SerieSummary[]>([]);
  readonly watchlist     = signal<SerieSummary[]>([]);
  readonly likes         = signal<SerieSummary[]>([]);
  readonly favorites     = signal<SerieSummary[]>([]);
  readonly dislikedIds   = signal<number[]>([]);
  
  // 🌟 ESTADOS DE UI
  readonly genreRows     = signal<SeriesRowModel[]>([]);
  readonly hero          = signal<SerieDetail | null>(null);
  readonly searchResults = signal<SerieSummary[]>([]);
  readonly status        = signal('');
  readonly toast         = signal('');
  readonly selectedSerie = signal<SerieSummary | null>(null);
  
  // 🌟 ESTADOS DEL MENÚ DESPLEGABLE
  readonly showLibraryDropdown = signal(false);
  readonly libraryModal = signal<{ title: string; items: SerieSummary[] } | null>(null);

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
  // MANEJO DE MODALES Y MENÚS
  // ─────────────────────────────────────────────────────────────────────────

  openDetailsModal(serie: SerieSummary): void {
    this.selectedSerie.set(serie);
  }

  closeDetailsModal(): void {
    this.selectedSerie.set(null);
  }

  openLibrary(title: string, items: SerieSummary[]): void {
    this.libraryModal.set({ title, items });
    this.showLibraryDropdown.set(false);
  }

  closeLibrary(): void {
    this.libraryModal.set(null);
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
      this.history.set(interactionState.history);
      this.watchlist.set(interactionState.watchlist);
      this.likes.set(interactionState.likes);
      this.favorites.set(interactionState.favorites);

      // Creamos un pool inmenso de todos los gustos para calcular los géneros matemáticamente
      const allInteractions = [
        ...interactionState.history, 
        ...interactionState.watchlist, 
        ...interactionState.likes, 
        ...interactionState.favorites
      ];
      const dynamicGenres = this.extractDynamicGenres(allInteractions);

      const visiblePopular = await this.hydrateMissingPosters(
        this.uniqueSeries(popular)
          .filter(s => !interactionState.dislikedIds.includes(s.id_tmdb))
          .slice(0, 18)
      );

      const genreRows = await this.loadGenreRows(dynamicGenres);

      const personalizedPool = this.personalizedPoolFrom(genreRows, interactionState.history, interactionState.watchlist, visiblePopular);
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
      this.genreRows.set(genreRows);

      const topCandidates = heroRail.slice(0, 5);
      const heroCandidate  = topCandidates.length > 0
          ? topCandidates[Math.floor(Math.random() * topCandidates.length)]
          : (visibleRecommendations[0] ?? visiblePopular[0] ?? null);

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
  // BÚSQUEDA E INTERACCIONES
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

 async onInteraction(event: { serie: SerieSummary; type: InteractionType }): Promise<void> {
    // 1. Verificamos si es un Toggle Off (Si ya tenía la interacción guardada)
    let isToggleOff = false;
    if (event.type === 'QUIERE_VER') isToggleOff = this.watchlist().some(s => s.id_tmdb === event.serie.id_tmdb);
    if (event.type === 'ES_FAVORITA') isToggleOff = this.favorites().some(s => s.id_tmdb === event.serie.id_tmdb);
    if (event.type === 'LE_GUSTA') isToggleOff = this.likes().some(s => s.id_tmdb === event.serie.id_tmdb);

    // 2. Enviamos la petición al backend
    await this.onboarding.recordInteraction(event.serie, event.type);
    
    // 3. Mostramos el mensaje correcto
    if (isToggleOff) {
      this.showToast('Se removió de tu colección.');
    } else {
      this.showToast(this.interactionMessage(event.type));
    }

    if (event.type === 'NO_LE_GUSTA') {
      this.dislikedIds.set(Array.from(new Set([...this.dislikedIds(), event.serie.id_tmdb])));
      this.recommendations.set(this.recommendations().filter(s => s.id_tmdb !== event.serie.id_tmdb));
      this.popular.set(this.popular().filter(s => s.id_tmdb !== event.serie.id_tmdb));
    }

    // Refrescamos silenciosamente todas las colecciones
    const state = await this.loadInteractionState();
    this.history.set(state.history);
    this.watchlist.set(state.watchlist);
    this.likes.set(state.likes);
    this.favorites.set(state.favorites);
    this.dislikedIds.set(state.dislikedIds);

    // Si el modal de la biblioteca está abierto, actualizamos su contenido en vivo
    const currentModal = this.libraryModal();
    if (currentModal) {
       if (currentModal.title === 'Mi Lista') this.libraryModal.set({ ...currentModal, items: this.watchlist() });
       else if (currentModal.title === 'Favoritos') this.libraryModal.set({ ...currentModal, items: this.favorites() });
       else if (currentModal.title === 'Me Gusta') this.libraryModal.set({ ...currentModal, items: this.likes() });
    }

    if (event.type === 'LE_GUSTA' || event.type === 'ES_FAVORITA') {
      const allInteractions = [...state.history, ...state.watchlist, ...state.likes, ...state.favorites];
      const dynamicGenres = this.extractDynamicGenres(allInteractions);
      this.loadGenreRows(dynamicGenres).then(newRows => this.genreRows.set(newRows));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HERO & NAVEGACIÓN
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

  heroGenres(): string { return this.hero()?.generos?.map(g => g.name).slice(0, 3).join(' / ') ?? ''; }
  heroPosterUrl(): string | null { return resolvePosterUrl(this.hero()?.poster); }
  posterUrl(serie: SerieSummary): string | null { return resolvePosterUrl(serie.poster); }

  async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigate(['/']);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LÓGICA INTERNA PRIVADA
  // ─────────────────────────────────────────────────────────────────────────

  private async loadRecommendations(): Promise<SerieSummary[]> {
    try {
      return await firstValueFrom(this.series.getRecomendaciones());
    } catch {
      const page = 1 + Math.floor(Math.random() * 3);
      return await firstValueFrom(this.series.getPopulares(page));
    }
  }

private async loadInteractionState(): Promise<{
    history: SerieSummary[];
    watchlist: SerieSummary[];
    favorites: SerieSummary[];
    likes: SerieSummary[];
    dislikedIds: number[];
  }> {
    try {
      const interactions = await firstValueFrom(this.series.getInteracciones());
      const history: SerieSummary[] = [];
      const watchlist: SerieSummary[] = [];
      const favorites: SerieSummary[] = [];
      const likes: SerieSummary[] = [];
      const dislikedIds: number[] = [];

      // Aumentamos el corte a 50 porque ahora una serie puede ocupar hasta 3 registros en la API
      const recentInteractions = interactions.slice(0, 50);
      const detailPromises = recentInteractions.map(item =>
        firstValueFrom(this.series.getDetalles(item.id_tmdb)).catch(() => item)
      );

      const details = await Promise.all(detailPromises);

      for (let i = 0; i < recentInteractions.length; i++) {
        const item = recentInteractions[i];
        const detail = details[i];

        // 🌟 EVITAMOS DUPLICADOS EN EL HISTORIAL (Crucial para que Angular no rompa la cuadrícula)
        if (!history.find(h => h.id_tmdb === detail.id_tmdb)) {
           history.push(detail);
        }

        if (item.interaccion === 'QUIERE_VER') watchlist.push(detail);
        if (item.interaccion === 'ES_FAVORITA') favorites.push(detail);
        if (item.interaccion === 'LE_GUSTA') likes.push(detail);
        if (item.interaccion === 'NO_LE_GUSTA') dislikedIds.push(item.id_tmdb);
      }

      return { history, watchlist, favorites, likes, dislikedIds };
    } catch {
      return { history: [], watchlist: [], favorites: [], likes: [], dislikedIds: [] };
    }
  }

  private extractDynamicGenres(allUserSeries: SerieSummary[]): any[] {
    const genreCounts = new Map<string, number>();
    const uniqueList = this.uniqueSeries(allUserSeries);

    uniqueList.forEach((serie: any) => {
      if (serie.generos) {
        serie.generos.forEach((g: any) => genreCounts.set(g.name, (genreCounts.get(g.name) || 0) + 1));
      }
    });

    const sortedGenreNames = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    const dynamicGenres = sortedGenreNames
      .map(name => GENRE_OPTIONS.find(g => g.name.toLowerCase() === name.toLowerCase()))
      .filter(g => !!g);

    const onboardingGenres = this.onboarding.ensureGenres();
    const finalGenres = [...dynamicGenres];
    
    onboardingGenres.forEach(og => {
      if (!finalGenres.find(g => g.id === og.id)) finalGenres.push(og);
    });

    return finalGenres.length ? finalGenres : DEFAULT_GENRES;
  }

  private async loadGenreRows(userGenres: any[]): Promise<SeriesRowModel[]> {
    const rows: SeriesRowModel[] = [];
    const topIds = userGenres.slice(0, 4).map(g => g.id);
    const topGenres = userGenres.slice(0, 4);
    
    const discoveryPool = GENRE_OPTIONS.filter(g => !topIds.includes(g.id));
    const discoveryGenres = discoveryPool.sort(() => Math.random() - 0.5).slice(0, 2);

    const mixedGenres = [...topGenres, ...discoveryGenres].sort(() => Math.random() - 0.5);
    const numRows = Math.floor(Math.random() * 3) + 3;
    const selectedGenres = mixedGenres.slice(0, numRows);

    for (const genre of selectedGenres) {
      const seen = new Set<number>();
      const items: SerieSummary[] = [];
      const shuffledQueries = [...genre.queries].sort(() => Math.random() - 0.5);
      const numQueries = Math.floor(Math.random() * 3) + 4;

      for (const query of shuffledQueries.slice(0, numQueries)) {
        try {
          const found = await firstValueFrom(this.series.searchSeries(query));
          const cleanFound = found.filter((s: SerieSummary) => !JUNK_WORDS.some(kw => s.titulo.toLowerCase().includes(kw)));
          const randomizedSeries = cleanFound.sort(() => Math.random() - 0.5);
          const numItems = Math.floor(Math.random() * 4) + 1;

          for (const item of randomizedSeries.slice(0, numItems)) {
            if (!seen.has(item.id_tmdb)) {
              seen.add(item.id_tmdb);
              items.push(item);
            }
          }
        } catch { continue; }
      }

      const maxRowSize = Math.floor(Math.random() * 7) + 10; 
      const visibleItems = await this.hydrateMissingPosters(items.filter((item) => !this.dislikedIds().includes(item.id_tmdb)).slice(0, maxRowSize));

      if (visibleItems.length > 0) {
        const isDiscovery = !topIds.includes(genre.id);
        rows.push({
          title: isDiscovery ? `Explora algo nuevo: ${genre.name}` : `Porque te gusta: ${genre.name}`,
          items: visibleItems,
          accent: genre.accent
        });
      }
    }
    return rows;
  }

  private async hydrateMissingPosters(items: SerieSummary[]): Promise<SerieSummary[]> {
    return Promise.all(
      items.map(async (serie) => {
        if (resolvePosterUrl(serie.poster)) return serie;
        try {
          const detail = await firstValueFrom(this.series.getDetalles(serie.id_tmdb));
          return {
            ...serie,
            poster: detail.poster ?? serie.poster,
            descripcion: serie.descripcion ?? detail.descripcion,
            youtube_key: serie.youtube_key ?? detail.youtube_key,
            plataformas: serie.plataformas?.length ? serie.plataformas : detail.plataformas
          };
        } catch { return serie; }
      })
    );
  }

  private mergeSeries(items: SerieSummary[], serie: SerieSummary): SerieSummary[] {
    return [serie, ...items.filter((item) => item.id_tmdb !== serie.id_tmdb)];
  }

  private personalizedPoolFrom(genreRows: SeriesRowModel[], history: SerieSummary[], watchlist: SerieSummary[], popular: SerieSummary[]): SerieSummary[] {
    const topIds = new Set(popular.slice(0, 10).map((serie) => serie.id_tmdb));
    const candidates = this.uniqueSeries([...watchlist, ...history, ...genreRows.flatMap((row) => row.items)]).filter((serie) => !this.dislikedIds().includes(serie.id_tmdb));
    const nonTop = candidates.filter((serie) => !topIds.has(serie.id_tmdb));
    return nonTop.length ? nonTop : candidates;
  }

  private uniqueSeries(items: SerieSummary[]): SerieSummary[] {
    const seen = new Set<number>();
    return items.filter((item) => {
      if (seen.has(item.id_tmdb)) return false;
      seen.add(item.id_tmdb);
      return true;
    });
  }

  private isSameRow(first: SerieSummary[], second: SerieSummary[]): boolean {
    if (!first.length || !second.length) return false;
    const firstIds = first.slice(0, 8).map((item) => item.id_tmdb);
    const secondIds = new Set(second.slice(0, 8).map((item) => item.id_tmdb));
    const overlap = firstIds.filter((id) => secondIds.has(id)).length;
    return overlap >= Math.min(5, firstIds.length);
  }

  private interactionMessage(type: InteractionType): string {
    const messages: Record<InteractionType, string> = {
      LE_GUSTA: 'Se guardó como gusto para tus recomendaciones.',
      ES_FAVORITA: 'Agregada a favoritos y Mi lista.',
      QUIERE_VER: 'Agregada a Mi lista.',
      NO_LE_GUSTA: 'Marcada como no me gusta. No la volveremos a sugerir.'
    };
    return messages[type];
  }

  private showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2400);
  }

  async retakeOnboarding(): Promise<void> {
    await this.router.navigate(['/clips']);
  }
}