package apperrors

import "fmt"

// AppError represents a standardized application error
type AppError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Err     error  `json:"-"` // Internal error, not marshaled to JSON
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (%v)", e.Type, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// New creates a new AppError
func New(errType, message string, err error) *AppError {
	return &AppError{
		Type:    errType,
		Message: message,
		Err:     err,
	}
}

// Common error types
const (
	TypeDatabase   = "DATABASE_ERROR"
	TypeValidation = "VALIDATION_ERROR"
	TypeNotFound   = "NOT_FOUND"
	TypeInternal   = "INTERNAL_ERROR"
)
