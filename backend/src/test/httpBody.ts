export interface AuthSuccessBody {
  accessToken: string;
  user: { id: string; email: string };
}

export interface ErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
