import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrincipalUsuariofPage } from './principal-usuariof.page';

describe('PrincipalUsuariofPage', () => {
  let component: PrincipalUsuariofPage;
  let fixture: ComponentFixture<PrincipalUsuariofPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PrincipalUsuariofPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
