import React, { useId } from 'react';
import { cn } from '../../lib/cn';

type FieldChrome = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  containerClassName?: string;
};

export const FormField: React.FC<
  React.PropsWithChildren<FieldChrome & { htmlFor?: string }>
> = ({ label, hint, error, required, htmlFor, containerClassName, children }) => (
  <div className={cn('flex flex-col', containerClassName)}>
    {label && (
      <label htmlFor={htmlFor} className="veth-label">
        {label}
        {required && <span style={{ color: 'var(--danger)' }} aria-hidden> *</span>}
      </label>
    )}
    {children}
    {error ? (
      <p role="alert" style={{ color: 'var(--danger)' }} className="mt-1 text-xs font-medium">
        {error}
      </p>
    ) : hint ? (
      <p style={{ color: 'var(--muted)' }} className="mt-1 text-xs">
        {hint}
      </p>
    ) : null}
  </div>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  error,
  required,
  id,
  className,
  containerClassName,
  ...rest
}) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const control = (
    <input
      id={inputId}
      className={cn('veth-input', className)}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={inputId} containerClassName={containerClassName}>
      {control}
    </FormField>
  );
};

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const Textarea: React.FC<TextareaProps> = ({
  label,
  hint,
  error,
  required,
  id,
  className,
  containerClassName,
  ...rest
}) => {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const control = (
    <textarea
      id={textareaId}
      className={cn('veth-textarea', className)}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={textareaId} containerClassName={containerClassName}>
      {control}
    </FormField>
  );
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export const Select: React.FC<SelectProps> = ({
  label,
  hint,
  error,
  required,
  id,
  className,
  containerClassName,
  children,
  ...rest
}) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  const control = (
    <select
      id={selectId}
      className={cn('veth-select', className)}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label && !hint && !error) return control;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={selectId} containerClassName={containerClassName}>
      {control}
    </FormField>
  );
};
