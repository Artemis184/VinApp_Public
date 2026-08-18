import { TestBed } from '@angular/core/testing';

import { AdminUsuarios } from '../../administrator_pages/services/admin-usuarios';

describe('AdminUsuarios', () => {
  let service: AdminUsuarios;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminUsuarios);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
