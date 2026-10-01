import { describe, expect, it } from 'vitest';
import { parseHttpFile } from './parser';
import { DEMO_TEMPLATES, DEFAULT_TEMPLATE_NAME } from './demoTemplates';

describe('demoTemplates', () => {
  it('exposes a default template that exists', () => {
    expect(DEMO_TEMPLATES.some((template) => template.name === DEFAULT_TEMPLATE_NAME)).toBe(true);
  });

  it('parses all templates with runnable requests', () => {
    for (const template of DEMO_TEMPLATES) {
      const file = parseHttpFile(template.text);
      expect(file.requests.length, template.name).toBeGreaterThan(0);
      for (const request of file.requests) {
        expect(request.url, `${template.name}/${request.title}`).toMatch(/^https?:\/\//);
      }
    }
  });

  it('the tour template showcases environments and auth echo', () => {
    const tour = DEMO_TEMPLATES.find((template) => template.name === DEFAULT_TEMPLATE_NAME);
    const file = parseHttpFile(tour!.text);
    expect(file.environments).toEqual(expect.arrayContaining(['staging', 'prod']));
    expect(file.requests.some((request) => request.headers.Authorization)).toBe(true);
    expect(file.requests.some((request) => request.body)).toBe(true);
  });

  it('the crud template covers every write method', () => {
    const crud = DEMO_TEMPLATES.find((template) => template.name === 'CRUD básico');
    const methods = parseHttpFile(crud!.text).requests.map((request) => request.method);
    expect(methods).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']));
  });

  it('real world template interpolates variables into its urls', () => {
    const realWorld = DEMO_TEMPLATES.find((template) => template.name === 'APIs do mundo real');
    const file = parseHttpFile(realWorld!.text);
    const forecast = file.requests.find((request) => request.url.includes('open-meteo'));
    expect(forecast?.url).toContain('latitude=-23.55');
  });
});
