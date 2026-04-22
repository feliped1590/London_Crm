import { useNavigate } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccessBlocked() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Clock className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Fora do horário permitido</CardTitle>
          <CardDescription className="mt-2">
            Sua empresa restringe o acesso ao sistema a horários específicos.
            Tente novamente dentro da janela autorizada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Se você acredita que deveria ter acesso agora, contate o
            administrador da sua empresa.
          </p>
          <Button
            onClick={() => navigate("/auth", { replace: true })}
            className="w-full"
            variant="outline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
