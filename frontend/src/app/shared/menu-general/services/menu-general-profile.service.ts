import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { MyProfileResponse } from '../interfaces/datos_usuario.interface';

@Injectable({
  providedIn: 'root',
})
export class MenuGeneralProfileService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users/profile`;

  getMyProfile(): Observable<MyProfileResponse> {
    return this.http.get<MyProfileResponse>(this.apiUrl);
  }

  updateMyProfile(payload: FormData): Observable<unknown> {
    return this.http.patch(this.apiUrl, payload);
  }
}
