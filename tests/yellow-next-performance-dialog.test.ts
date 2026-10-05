import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("the operating performance matrix has semantic six-column headers and stable value alignment", () => {
  expect(app).toContain('<colgroup>');
  expect(app).toContain('className="performance-period-column"');
  expect(app).toContain('className="performance-measure-column"');
  expect(app).toContain('className="performance-value-column"');
  expect(app).toContain('scope="col" className="performance-period">Period</th>');
  expect(app).toContain('scope="col" className="performance-measure">Measure</th>');
  expect(app).toContain('scope="col" className="performance-value">Actual</th>');
  expect(app).toContain('scope="rowgroup"');
  expect(app).toContain('scope="row" className="performance-measure"');
  expect(app).toContain('className="performance-value"');
  expect(css).toContain('.performance-table { table-layout: fixed; min-width: 760px; }');
  expect(css).toContain('.performance-period-column { width: 96px; }');
  expect(css).toContain('.performance-table-wrap { -webkit-overflow-scrolling: touch; }');
});
