import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog"
  
  interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    eventName: string
  }
  
  export function ConfirmationModal({ isOpen, onClose, onConfirm, eventName }: ConfirmationModalProps) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar registro</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas registrarte para el evento &quot;{eventName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={onConfirm}
                className="bg-blue-800 text-white hover:bg-blue-700 focus:ring-blue-500">
                Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }
  
  