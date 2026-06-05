export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface User {
  id: string;
  nombre: string;
  correo: string;
  rol?: string;
}

export interface AuthPayload {
  usuario: User;
  token: string;
}

export interface LoginCredentials {
  correo: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  nombre: string;
}
export interface Platform {
  nombre: string;
  logo?: string;
}

export interface SerieSummary {
  id_tmdb: number;
  titulo: string;
  poster?: string | null;
  descripcion?: string | null;
  fecha_salida?: string | null;
  youtube_key?: string | null;
  plataformas?: Platform[];
  score?: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface SerieDetail extends SerieSummary {
  calificacion?: number;
  generos?: Genre[];
}

export type InteractionType = 'LE_GUSTA' | 'ES_FAVORITA' | 'QUIERE_VER' | 'NO_LE_GUSTA';

export interface Interaction {
  id_tmdb: number;
  titulo: string;
  interaccion: InteractionType;
}

export interface GenreOption {
  id: string;
  name: string;
  mood: string;
  accent: string;
  queries: string[];
}

export interface SeriesRow {
  title: string;
  items: SerieSummary[];
  accent?: string;
}