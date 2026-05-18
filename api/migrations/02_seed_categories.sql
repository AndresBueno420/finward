-- +goose Up
INSERT INTO categories (id, name, type) VALUES
  (uuid_generate_v4(), 'Alimentación',    'gasto'),
  (uuid_generate_v4(), 'Transporte',      'gasto'),
  (uuid_generate_v4(), 'Entretenimiento', 'gasto'),
  (uuid_generate_v4(), 'Suscripciones',   'gasto'),
  (uuid_generate_v4(), 'Salud',           'gasto'),
  (uuid_generate_v4(), 'Otros',           'gasto')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM categories WHERE name IN (
  'Alimentación', 'Transporte', 'Entretenimiento',
  'Suscripciones', 'Salud', 'Otros'
) AND type = 'gasto';
