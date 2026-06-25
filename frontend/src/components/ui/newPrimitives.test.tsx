import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Input, Select, Textarea, FormField } from './Form';
import { Modal } from './Modal';
import { Tabs, type TabItem } from './Tabs';

describe('Form primitives', () => {
  it('Input asocia label con el control vía htmlFor/id', () => {
    render(<Input label="Nombre" defaultValue="" />);
    const input = screen.getByLabelText('Nombre');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('Input muestra error con role=alert y aria-invalid', () => {
    render(<Input label="Email" error="Requerido" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Requerido');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('Textarea rinde y acepta texto', () => {
    render(<Textarea label="Notas" />);
    expect(screen.getByLabelText('Notas').tagName).toBe('TEXTAREA');
  });

  it('Select rinde opciones', () => {
    render(
      <Select label="Especie">
        <option value="perro">Perro</option>
        <option value="gato">Gato</option>
      </Select>,
    );
    const select = screen.getByLabelText('Especie');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Perro' })).toBeInTheDocument();
  });

  it('FormField muestra hint cuando no hay error', () => {
    render(
      <FormField label="Peso" hint="en kg" htmlFor="x">
        <input id="x" />
      </FormField>,
    );
    expect(screen.getByText('en kg')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('no rinde cuando open=false', () => {
    render(<Modal open={false} onClose={() => {}} title="X" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rinde dialog accesible con título', () => {
    render(<Modal open onClose={() => {}} title="Confirmar" description="desc" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Confirmar')).toBeInTheDocument();
  });

  it('Escape dispara onClose', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="X" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('botón cerrar dispara onClose', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="X" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Tabs', () => {
  const items: TabItem[] = [
    { id: 'a', label: 'Uno' },
    { id: 'b', label: 'Dos' },
    { id: 'c', label: 'Tres' },
  ];

  function Harness() {
    const [value, setValue] = useState('a');
    return <Tabs items={items} value={value} onChange={setValue} ariaLabel="Secciones" />;
  }

  it('rinde tablist con tab activo', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('aria-selected', 'true');
  });

  it('roving tabindex: solo el activo es tabbable', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Dos' })).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight cambia el tab seleccionado', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Uno' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Dos' })).toHaveAttribute('aria-selected', 'true');
  });

  it('click selecciona el tab', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tres' }));
    expect(screen.getByRole('tab', { name: 'Tres' })).toHaveAttribute('aria-selected', 'true');
  });
});
