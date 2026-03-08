package printer

import (
	"fmt"
	"os/exec"
	"runtime"
)

// PrintFile opens the given PDF file using the OS default application.
// On Windows, it uses cmd /c start; on macOS/Linux, it uses open/lpr.
func PrintFile(pdfPath string) error {
	switch runtime.GOOS {
	case "windows":
		cmd := exec.Command("cmd", "/c", "start", "/wait", "", pdfPath)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("print PDF on Windows: %w", err)
		}
	case "darwin":
		cmd := exec.Command("open", pdfPath)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("print PDF on macOS: %w", err)
		}
	default:
		cmd := exec.Command("lpr", pdfPath)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("print PDF on Linux: %w", err)
		}
	}
	return nil
}
